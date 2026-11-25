/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/rebrota.ts
 * O que faz: regras da Rebrota, o prestígio do jogo. Quando o Estio vence, a
 * clareira rebrota: a jornada recomeça do início, mas a pessoa finca Raízes
 * que deixam tudo mais forte para sempre. Cada Rebrota é uma nova edição do
 * folheto.
 *
 * Também mora aqui a compra automática de melhorias ("Mão ligeira"), porque
 * ela existe para tirar o trabalho repetitivo do começo de cada edição.
 *
 * Módulo puro: não lê o relógio nem sorteia por conta própria. As ações
 * recebem o estado e devolvem um estado novo, ou null quando não valem.
 *
 * Mapa:
 *   1. Raízes que a Rebrota rende
 *   2. Quando a Rebrota aparece e quando libera
 *   3. Rebrotar
 *   4. Compra automática de melhorias
 */

import { BALANCE } from '../data/balance';
import { UPGRADES } from '../data/upgrades';
import type { RandomSource } from '../utils/random';
import { buyUpgrade } from './actions';
import { getEnemy, getZoneForStage } from './catalog';
import { getGoldReward, getRootsForRebrota, getUpgradeCost, isUpgradeMaxed } from './formulas';
import { getJuazeiroBonuses, hasAutoBuyNode } from './juazeiro';
import { createCommonEnemyCombat, createOwnedEncantado } from './state';
import type { GameState, OwnedEncantado } from './types';

const FIRST_STAGE = 1;
const SECONDS_PER_HOUR = 3600;
const MAX_STAGE_SEARCH = 10_000; // limite da busca pela próxima Raiz
const MAX_AUTO_PURCHASES = 1_000; // limite de compras automáticas de uma vez

// =============================================================================
// =============================================================================
// R A Í Z E S   Q U E   A   R E B R O T A   R E N D E

/**
 * Raízes que rebrotar agora renderia.
 *
 * Só conta o que passar do recorde: ganho = Raízes do maior estágio desta
 * edição − Raízes do recorde das edições anteriores. Isso impede ganhar
 * Raízes rebrotando sem parar no mesmo ponto.
 *
 * @param state Estado atual. Só é lido.
 * @returns Raízes a ganhar. Zero quando a edição não passou do recorde.
 */
export function getRebrotaGain(state: GameState): number {
  const reachedRoots = getRootsForRebrota(state.maxStage);
  const recordRoots = getRootsForRebrota(state.recordStage);
  return Math.max(0, reachedRoots - recordRoots);
}

/**
 * Primeiro estágio em que o ganho da Rebrota sobe mais uma Raiz.
 *
 * @param state Estado atual. Só é lido.
 * @returns Estágio que precisa ser liberado para render uma Raiz a mais que agora.
 *
 * Caso de borda: se nenhum estágio até um limite muito alto mudar o ganho
 * (o que não acontece com as fórmulas atuais), devolve o estágio atual + 1.
 */
export function getNextRootStage(state: GameState): number {
  const best = Math.max(state.maxStage, state.recordStage);
  const bestRoots = getRootsForRebrota(best);

  for (let stage = best + 1; stage <= best + MAX_STAGE_SEARCH; stage += 1) {
    if (getRootsForRebrota(stage) > bestRoots) {
      return stage;
    }
  }

  return best + 1;
}

// Raízes por hora desta edição. Ajuda a decidir entre seguir e rebrotar.
export function getRootsPerHour(state: GameState): number {
  if (!(state.editionSeconds > 0)) {
    return 0;
  }

  return getRebrotaGain(state) / (state.editionSeconds / SECONDS_PER_HOUR);
}


// =============================================================================
// =============================================================================
// Q U A N D O   A   R E B R O T A   A P A R E C E   E   Q U A N D O   L I B E R A

/**
 * Diz se a Rebrota está liberada.
 *
 * Pede comitiva formada e ganho de pelo menos rebrotaMinRoots Raízes. A
 * primeira Rebrota pede também o estágio rebrotaFirstStage, que é onde a
 * primeira edição desacelera sozinha (por volta de 25 a 30 minutos de jogo).
 *
 * @param state Estado atual. Só é lido.
 * @returns true se o botão "Rebrotar" pode ser usado agora.
 */
export function canRebrota(state: GameState): boolean {
  const hasParty = state.party.length > 0;
  const hasEnoughGain = getRebrotaGain(state) >= BALANCE.rebrotaMinRoots;
  return hasParty && hasEnoughGain && getRebrotaStageNeeded(state) <= state.maxStage;
}

// Estágio mínimo para rebrotar: o da primeira Rebrota, ou o que rende o mínimo de Raízes
export function getRebrotaStageNeeded(state: GameState): number {
  const firstStage = state.recordStage === 0 ? BALANCE.rebrotaFirstStage : 0;
  const recordRoots = getRootsForRebrota(state.recordStage);
  let stage = Math.max(state.recordStage + 1, firstStage);

  while (getRootsForRebrota(stage) - recordRoots < BALANCE.rebrotaMinRoots) {
    stage += 1;
  }

  return stage;
}

// O juazeiro aparece no primeiro chefe que escapa (o primeiro muro), ou quando já houve
// Rebrota, ou quando ela já está liberada. Antes disso ele fica escondido.
export function isJuazeiroRevealed(state: GameState): boolean {
  const hasHitWall = state.stats.bossesFailed > 0;
  const hasRebrotado = state.edition > 1 || state.roots > 0;
  return hasHitWall || hasRebrotado || canRebrota(state);
}


// =============================================================================
// =============================================================================
// R E B R O T A R

/**
 * Rebrota a clareira: começa uma nova edição do folheto.
 *
 * Fica: elenco (encantados conquistados), comitiva, Rastros, amuletos, Cavacos,
 * Raízes, juazeiro, recorde, estatísticas totais e as chaves da pessoa (avanço
 * automático, desmanche automático, compra automática).
 *
 * Volta ao começo: estágio, Patacas, melhorias, Oferendas e o nível e o XP de
 * cada encantado. O laço (bond) dos encantados fica.
 *
 * Com o juazeiro: "Atalho da trilha" faz começar alguns estágios à frente,
 * mas nunca a menos de rebrotaStageMargin estágios do recorde. "Bolsa herdada"
 * dá Patacas iniciais iguais às de startGoldKills visagens do estágio de início
 * por nível.
 *
 * @param state Estado atual. Não é alterado.
 * @param random Fonte de números aleatórios, usada para sortear a primeira visagem.
 * @returns Estado da nova edição, ou null se a Rebrota ainda não está liberada.
 */
export function performRebrota(state: GameState, random: RandomSource): GameState | null {
  if (!canRebrota(state)) {
    return null;
  }

  const gain = getRebrotaGain(state);
  const recordStage = Math.max(state.recordStage, state.maxStage);
  const bonuses = getJuazeiroBonuses(state.juazeiro);
  const startStage = getStartStage(bonuses.startStage, recordStage);

  return {
    ...state,
    gold: getStartGold(startStage, bonuses.startGold),
    stage: startStage,
    maxStage: startStage,
    killsInStage: 0,
    roster: resetRoster(state.roster),
    inventory: {},
    upgrades: {},
    roots: state.roots + gain,
    edition: state.edition + 1,
    recordStage,
    editionSeconds: 0,
    combat: createCommonEnemyCombat(startStage, {}, random),
  };
}

// Estágio de início da edição: 1 + atalho, sem chegar perto demais do recorde
function getStartStage(stageBonus: number, recordStage: number): number {
  const ceiling = Math.max(FIRST_STAGE, recordStage - BALANCE.rebrotaStageMargin);
  return Math.min(FIRST_STAGE + stageBonus, ceiling);
}

// Patacas iniciais: as de startGoldKills visagens do estágio de início, por nível
function getStartGold(startStage: number, startGoldLevels: number): number {
  if (startGoldLevels <= 0) {
    return 0;
  }

  const zone = getZoneForStage(startStage);
  const enemyId = zone.enemyIds[0];

  if (enemyId === undefined) {
    return 0;
  }

  const goldPerKill = getGoldReward(startStage, getEnemy(enemyId), false, 1);
  return goldPerKill * BALANCE.startGoldKills * startGoldLevels;
}

// Cada encantado volta ao nível 1, sem XP, mantendo o laço
function resetRoster(roster: Record<string, OwnedEncantado>): Record<string, OwnedEncantado> {
  const reset: Record<string, OwnedEncantado> = {};

  for (const [encantadoId, owned] of Object.entries(roster)) {
    reset[encantadoId] = { ...createOwnedEncantado(encantadoId), bond: owned.bond };
  }

  return reset;
}


// =============================================================================
// =============================================================================
// C O M P R A   A U T O M Á T I C A   D E   M E L H O R I A S

// Liga ou desliga a compra automática. Null sem o nó "Mão ligeira" ou sem mudança.
export function setAutoBuy(state: GameState, enabled: boolean): GameState | null {
  if (!hasAutoBuyNode(state) || state.autoBuy === enabled) {
    return null;
  }

  return { ...state, autoBuy: enabled };
}

/**
 * Compra melhorias sozinha enquanto houver Patacas, sempre a mais barata primeiro.
 *
 * Comprar a mais barata espalha os níveis entre as melhorias, que é o que uma
 * pessoa atenta faria no começo de uma edição.
 *
 * @param state Estado atual. Não é alterado.
 * @returns Estado com as compras feitas, ou o mesmo "state" se nada foi comprado.
 *
 * Casos de borda: não faz nada se a chave estiver desligada ou se a pessoa não
 * tiver o nó "Mão ligeira". Para em MAX_AUTO_PURCHASES compras por chamada.
 */
export function autoBuyUpgrades(state: GameState): GameState {
  if (!state.autoBuy || !hasAutoBuyNode(state)) {
    return state;
  }

  let current = state;

  for (let purchase = 0; purchase < MAX_AUTO_PURCHASES; purchase += 1) {
    const cheapestId = findCheapestAffordableUpgrade(current);
    const next = cheapestId === null ? null : buyUpgrade(current, cheapestId);

    if (next === null) {
      break;
    }

    current = next;
  }

  return current;
}

// Id da melhoria mais barata que dá para comprar agora, ou null se nenhuma dá
function findCheapestAffordableUpgrade(state: GameState): string | null {
  let cheapestId: string | null = null;
  let cheapestCost = Infinity;

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id] ?? 0;
    const cost = getUpgradeCost(upgrade, level);
    const isCandidate = !isUpgradeMaxed(upgrade, level) && cost <= state.gold;

    if (isCandidate && cost < cheapestCost) {
      cheapestId = upgrade.id;
      cheapestCost = cost;
    }
  }

  return cheapestId;
}
