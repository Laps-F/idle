/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/actions.ts
 * O que faz: as regras das ações que a pessoa pode tomar: escolher o
 * encantado inicial, montar a comitiva, comprar melhorias, desafiar o chefe
 * e trocar de estágio.
 *
 * Padrão de todas as funções: recebem o estado e os dados da ação e devolvem
 * um estado NOVO, ou null quando a ação não é permitida. Nunca alteram o
 * estado recebido. A store chama essas funções e grava o resultado.
 *
 * Mapa:
 *   1. Comitiva
 *   2. Melhorias
 *   3. Estágios e chefe
 *   4. Recursos
 */

import { BALANCE } from '../data/balance';
import type { RandomSource } from '../utils/random';
import { getEncantado, getUpgrade, getZoneForStage, hasEncantado, hasUpgrade } from './catalog';
import { getUpgradeCost, isUpgradeMaxed } from './formulas';
import { createBossCombat, createCommonEnemyCombat, createOwnedEncantado } from './state';
import type { GameState } from './types';

// =============================================================================
// =============================================================================
// C O M I T I V A

/**
 * Escolhe o primeiro encantado da comitiva.
 *
 * @param state Estado de partida. Não é alterado.
 * @param encantadoId Id de um encantado inicial (isStarter em src/data/encantados.ts).
 * @returns Estado novo com o encantado no elenco e na comitiva, ou null se não for permitido.
 *
 * Casos de borda: devolve null se o elenco já tem alguém (a escolha vale uma vez só),
 * se o id não existe ou se o encantado não é inicial.
 */
export function chooseStarter(state: GameState, encantadoId: string): GameState | null {
  const hasNoRoster = Object.keys(state.roster).length === 0;
  const isStarter = hasEncantado(encantadoId) && getEncantado(encantadoId).isStarter;

  if (!hasNoRoster || !isStarter) {
    return null;
  }

  return {
    ...state,
    roster: { [encantadoId]: createOwnedEncantado(encantadoId) },
    party: [encantadoId],
    combat: { ...state.combat, attackProgress: { [encantadoId]: 0 } },
  };
}

// Tira da comitiva quem está nela, ou coloca quem está fora. Null se não for permitido.
export function togglePartyMember(state: GameState, encantadoId: string): GameState | null {
  return state.party.includes(encantadoId)
    ? removeFromParty(state, encantadoId)
    : addToParty(state, encantadoId);
}

// Sai da comitiva, desde que não seja o último. A barra de ataque dele é descartada.
function removeFromParty(state: GameState, encantadoId: string): GameState | null {
  const isLastMember = state.party.length <= 1;

  if (isLastMember) {
    return null;
  }

  const remainingProgress = Object.entries(state.combat.attackProgress).filter(
    ([memberId]) => memberId !== encantadoId,
  );

  return {
    ...state,
    party: state.party.filter((memberId) => memberId !== encantadoId),
    combat: { ...state.combat, attackProgress: Object.fromEntries(remainingProgress) },
  };
}

// Entra na comitiva, desde que esteja no elenco e haja vaga. A barra de ataque começa vazia.
function addToParty(state: GameState, encantadoId: string): GameState | null {
  const isOwned = encantadoId in state.roster;
  const hasRoom = state.party.length < BALANCE.maxPartySize;

  if (!isOwned || !hasRoom) {
    return null;
  }

  const attackProgress = { ...state.combat.attackProgress, [encantadoId]: 0 };
  return {
    ...state,
    party: [...state.party, encantadoId],
    combat: { ...state.combat, attackProgress },
  };
}


// =============================================================================
// =============================================================================
// M E L H O R I A S

/**
 * Compra um nível de uma melhoria.
 *
 * @param state Estado de partida. Não é alterado.
 * @param upgradeId Id da melhoria em src/data/upgrades.ts.
 * @returns Estado novo com o nível somado e as Patacas descontadas, ou null se não for permitido.
 *
 * Casos de borda: devolve null se o id não existe, se faltam Patacas ou se a
 * melhoria já está no nível máximo.
 */
export function buyUpgrade(state: GameState, upgradeId: string): GameState | null {
  if (!hasUpgrade(upgradeId)) {
    return null;
  }

  const upgrade = getUpgrade(upgradeId);
  const level = state.upgrades[upgradeId] ?? 0;
  const cost = getUpgradeCost(upgrade, level);
  const canBuy = state.gold >= cost && !isUpgradeMaxed(upgrade, level);

  if (!canBuy) {
    return null;
  }

  return {
    ...state,
    gold: state.gold - cost,
    upgrades: { ...state.upgrades, [upgradeId]: level + 1 },
  };
}


// =============================================================================
// =============================================================================
// E S T Á G I O S   E   C H E F E

// Liga ou desliga o avanço automático de estágio
export function setAutoProgress(state: GameState, enabled: boolean): GameState {
  return { ...state, autoProgress: enabled };
}

// Diz se o chefe pode ser desafiado: contagem de visagens fechada e nenhum chefe em campo
export function canChallengeBoss(state: GameState): boolean {
  const zone = getZoneForStage(state.stage);
  return !state.combat.isBoss && state.killsInStage >= zone.killsToBoss;
}

// Chama o chefe na hora, para quem joga com o avanço automático desligado. Null se não puder.
export function challengeBoss(state: GameState): GameState | null {
  if (!canChallengeBoss(state)) {
    return null;
  }

  return { ...state, combat: createBossCombat(state.stage, state.combat.attackProgress) };
}

/**
 * Muda para um estágio já liberado, para voltar e juntar Oferendas.
 *
 * @param state Estado de partida. Não é alterado.
 * @param stage Estágio de destino, de 1 até state.maxStage.
 * @param random Fonte de números aleatórios, usada para sortear a visagem do estágio.
 * @returns Estado novo no estágio pedido, com a contagem de visagens zerada e uma
 *          visagem nova em campo. Null se o estágio não estiver liberado.
 *
 * Casos de borda: devolve null para número que não é inteiro, menor que 1 ou maior
 * que o maior estágio liberado. Trocar de estágio no meio de um chefe abandona o chefe.
 */
export function goToStage(state: GameState, stage: number, random: RandomSource): GameState | null {
  const isUnlocked = Number.isInteger(stage) && stage >= 1 && stage <= state.maxStage;

  if (!isUnlocked) {
    return null;
  }

  return {
    ...state,
    stage,
    killsInStage: 0,
    combat: createCommonEnemyCombat(stage, state.combat.attackProgress, random),
  };
}


// =============================================================================
// =============================================================================
// R E C U R S O S

// Soma Patacas direto no saldo, sem contar como Patacas ganhas. Null se o valor não for positivo.
export function grantGold(state: GameState, amount: number): GameState | null {
  if (!(amount > 0)) {
    return null;
  }

  return { ...state, gold: state.gold + amount };
}
