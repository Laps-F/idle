/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/state.ts
 * O que faz: constrói as peças do estado do jogo: o jogo novo, um encantado
 * recém-conquistado, o combate contra uma visagem ou um chefe. Todas as
 * funções são puras: devolvem um objeto novo e não alteram o que recebem.
 *
 * Mapa:
 *   1. Jogo novo
 *   2. Combate
 *   3. Cópia do estado
 */

import { BALANCE } from '../data/balance';
import { pickRandom } from '../utils/random';
import type { RandomSource } from '../utils/random';
import { getEnemy, getFirstWorldMap, getZoneForStage } from './catalog';
import { getEnemyMaxHp } from './formulas';
import type {
  CombatState,
  GameState,
  GameStats,
  OwnedEncantado,
  SimulationSummary,
  WorldPosition,
} from './types';

// =============================================================================
// =============================================================================
// J O G O   N O V O

const FIRST_STAGE = 1;
const FIRST_LEVEL = 1;

/**
 * Cria o estado de um jogo novo, com a primeira visagem já em campo.
 *
 * @param now Instante atual em milissegundos. Vira a marca de tempo do estado.
 * @param random Fonte de números aleatórios, usada para sortear a primeira visagem.
 * @returns Estado no estágio 1, sem comitiva, sem Patacas e com o avanço automático ligado.
 *          No mundo aberto, a personagem está no ponto de partida do primeiro mapa.
 */
export function createInitialState(now: number, random: RandomSource): GameState {
  return {
    version: BALANCE.saveVersion,
    gold: 0,
    stage: FIRST_STAGE,
    maxStage: FIRST_STAGE,
    killsInStage: 0,
    autoProgress: true,
    party: [],
    roster: {},
    trails: {},
    inventory: {},
    upgrades: {},
    roots: 0,
    juazeiro: {},
    edition: 1,
    recordStage: 0,
    editionSeconds: 0,
    autoBuy: false,
    amulets: {},
    equipped: {},
    shavings: 0,
    autoSalvage: null,
    nextAmuletNumber: 1,
    combat: createCommonEnemyCombat(FIRST_STAGE, {}, random),
    world: createStartPosition(),
    lastSaveTimestamp: now,
    stats: createEmptyStats(),
  };
}

// Ponto de partida do mundo aberto: o centro do ladrilho inicial do primeiro mapa
export function createStartPosition(): WorldPosition {
  const map = getFirstWorldMap();
  return { mapId: map.id, x: map.start.x + 0.5, y: map.start.y + 0.5 };
}

// Estatísticas zeradas de uma partida nova
export function createEmptyStats(): GameStats {
  return {
    totalKills: 0,
    totalGoldEarned: 0,
    bossesDefeated: 0,
    playTimeSeconds: 0,
    amuletsFound: 0,
    bossesFailed: 0,
  };
}

// Encantado que acabou de entrar no elenco: nível 1, sem XP e sem laço
export function createOwnedEncantado(encantadoId: string): OwnedEncantado {
  return { id: encantadoId, level: FIRST_LEVEL, xp: 0, bond: 0 };
}

// Resumo zerado de um trecho simulado
export function createEmptySummary(): SimulationSummary {
  return {
    seconds: 0,
    gold: 0,
    xp: 0,
    kills: 0,
    bossesDefeated: 0,
    bossesFailed: 0,
    stagesAdvanced: 0,
    items: {},
    trails: {},
    levelUps: {},
    amuletsFound: 0,
    amuletsSalvaged: 0,
    shavings: 0,
  };
}


// =============================================================================
// =============================================================================
// C O M B A T E

/**
 * Monta o combate contra uma visagem sorteada da zona do estágio.
 *
 * @param stage Estágio atual. Define a zona e a vida da visagem.
 * @param attackProgress Barras de ataque da comitiva, que continuam de onde estavam.
 * @param random Fonte de números aleatórios, usada para sortear a visagem.
 * @returns Combate novo, com a vida cheia e sem tempo de chefe.
 */
export function createCommonEnemyCombat(
  stage: number,
  attackProgress: Record<string, number>,
  random: RandomSource,
): CombatState {
  const zone = getZoneForStage(stage);
  const enemyId = pickRandom(zone.enemyIds, random);
  const maxHp = getEnemyMaxHp(stage, getEnemy(enemyId), false);

  return {
    enemyId,
    enemyHp: maxHp,
    enemyMaxHp: maxHp,
    isBoss: false,
    bossTimeLeft: 0,
    attackProgress,
  };
}

/**
 * Monta o combate contra o chefe da zona do estágio.
 *
 * @param stage Estágio atual. Define a zona, o chefe e a vida dele.
 * @param attackProgress Barras de ataque da comitiva, que continuam de onde estavam.
 * @param timeLimit Segundos para vencer o chefe. Quem chama usa getBossTimeLimit
 *                  (src/domain/juazeiro.ts), que soma o bônus do juazeiro ao da zona.
 * @returns Combate novo, com a vida cheia e o tempo do chefe inteiro.
 */
export function createBossCombat(
  stage: number,
  attackProgress: Record<string, number>,
  timeLimit: number,
): CombatState {
  const zone = getZoneForStage(stage);
  const maxHp = getEnemyMaxHp(stage, getEnemy(zone.bossId), true);

  return {
    enemyId: zone.bossId,
    enemyHp: maxHp,
    enemyMaxHp: maxHp,
    isBoss: true,
    bossTimeLeft: timeLimit,
    attackProgress,
  };
}


// =============================================================================
// =============================================================================
// C Ó P I A   D O   E S T A D O

// Separa só os campos do jogo. Serve para tirar as ações e os campos de sessão da store.
export function pickGameState(source: GameState): GameState {
  return {
    version: source.version,
    gold: source.gold,
    stage: source.stage,
    maxStage: source.maxStage,
    killsInStage: source.killsInStage,
    autoProgress: source.autoProgress,
    party: source.party,
    roster: source.roster,
    trails: source.trails,
    inventory: source.inventory,
    upgrades: source.upgrades,
    roots: source.roots,
    juazeiro: source.juazeiro,
    edition: source.edition,
    recordStage: source.recordStage,
    editionSeconds: source.editionSeconds,
    autoBuy: source.autoBuy,
    amulets: source.amulets,
    equipped: source.equipped,
    shavings: source.shavings,
    autoSalvage: source.autoSalvage,
    nextAmuletNumber: source.nextAmuletNumber,
    combat: source.combat,
    world: source.world,
    lastSaveTimestamp: source.lastSaveTimestamp,
    stats: source.stats,
  };
}

// Cópia completa e independente do estado. Alterar a cópia não toca no original.
export function cloneGameState(source: GameState): GameState {
  return structuredClone(pickGameState(source));
}
