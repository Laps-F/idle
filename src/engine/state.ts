/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/engine/state.ts
 * O que faz: cria o estado de um jogo novo e coloca inimigos em campo.
 * As funções "spawn" alteram o estado recebido.
 *
 * Mapa:
 *   1. Estado inicial
 *   2. Entrada de inimigos
 *   3. Cópia do estado
 */

import { BALANCE } from '../data/balance';
import { getEnemy, getZoneForStage } from '../data';
import type { CombatState, GameState, RandomSource, SimulationSummary } from '../types/game';
import { pickRandom } from '../utils/random';
import { getEnemyMaxHp } from './formulas';

// =============================================================================
// =============================================================================
// E S T A D O   I N I C I A L

// Estado de um jogo novo, com a primeira visagem já em campo
export function createInitialState(now: number, random: RandomSource = Math.random): GameState {
  const state: GameState = {
    version: BALANCE.saveVersion,
    gold: 0,
    stage: 1,
    maxStage: 1,
    killsInStage: 0,
    autoProgress: true,
    party: [],
    roster: {},
    trails: {},
    inventory: {},
    upgrades: {},
    roots: 0,
    combat: createEmptyCombat(),
    lastSaveTimestamp: now,
    stats: { totalKills: 0, totalGoldEarned: 0, bossesDefeated: 0, playTimeSeconds: 0 },
  };

  spawnCommonEnemy(state, random);
  return state;
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
  };
}

// Combate vazio, usado só até a primeira visagem entrar
function createEmptyCombat(): CombatState {
  return {
    enemyId: '',
    enemyHp: 0,
    enemyMaxHp: 0,
    isBoss: false,
    bossTimeLeft: 0,
    attackProgress: {},
  };
}


// =============================================================================
// =============================================================================
// E N T R A D A   D E   I N I M I G O S

// Coloca em campo uma visagem sorteada da zona do estágio atual
export function spawnCommonEnemy(state: GameState, random: RandomSource): void {
  const zone = getZoneForStage(state.stage);
  const enemyId = pickRandom(zone.enemyIds, random);
  const maxHp = getEnemyMaxHp(state.stage, getEnemy(enemyId), false);

  state.combat.enemyId = enemyId;
  state.combat.enemyHp = maxHp;
  state.combat.enemyMaxHp = maxHp;
  state.combat.isBoss = false;
  state.combat.bossTimeLeft = 0;
}

// Coloca em campo o chefe da zona do estágio atual, com o tempo cheio
export function spawnBoss(state: GameState): void {
  const zone = getZoneForStage(state.stage);
  const maxHp = getEnemyMaxHp(state.stage, getEnemy(zone.bossId), true);

  state.combat.enemyId = zone.bossId;
  state.combat.enemyHp = maxHp;
  state.combat.enemyMaxHp = maxHp;
  state.combat.isBoss = true;
  state.combat.bossTimeLeft = zone.bossTimeLimit;
}


// =============================================================================
// =============================================================================
// C Ó P I A   D O   E S T A D O

// Separa só os campos do jogo. Serve para tirar as ações da store antes de salvar ou copiar.
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
    combat: source.combat,
    lastSaveTimestamp: source.lastSaveTimestamp,
    stats: source.stats,
  };
}

// Cópia completa e independente do estado, para o motor alterar à vontade
export function cloneGameState(source: GameState): GameState {
  return structuredClone(pickGameState(source));
}
