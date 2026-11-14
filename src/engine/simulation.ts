/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/engine/simulation.ts
 * O que faz: avança o combate por um intervalo de tempo qualquer. É o coração
 * do motor. A mesma função serve para o tick de 0,1 s e para horas de
 * ausência, porque ela pula de evento em evento (próximo golpe ou fim do
 * tempo do chefe) em vez de andar em passos fixos.
 *
 * Todas as funções daqui alteram o estado recebido. Quem chama passa uma cópia.
 *
 * Mapa:
 *   1. Constantes e tipos
 *   2. Avanço da simulação
 *   3. Tempo: próximo evento e relógios
 *   4. Golpes
 *   5. Derrota de inimigos e chefes
 *   6. Recompensas
 */

import { BALANCE, MS_PER_SECOND } from '../data/balance';
import { getEncantado, getEnemy, getZoneForStage } from '../data';
import type {
  CombatEvent,
  DayPhase,
  EnemyDef,
  GameState,
  Modifiers,
  RandomSource,
  SimulationSummary,
} from '../types/game';
import { randomInteger, rollChance } from '../utils/random';
import { getDayPhase, matchesClock } from './clock';
import {
  getAttackDamage,
  getAttackInterval,
  getGoldReward,
  getXpReward,
  getXpToNextLevel,
} from './formulas';
import { getModifiersByPhase } from './modifiers';
import { createEmptySummary, spawnBoss, spawnCommonEnemy } from './state';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

// Folga para erro de arredondamento ao comparar tempos e progressos
const TIME_EPSILON = 1e-9;

// Passo mínimo, para a simulação sempre andar mesmo com arredondamento
const MIN_STEP_SECONDS = 1e-6;

// Trava de segurança: nenhum trecho simulado passa deste número de eventos
const MAX_ITERATIONS = 5_000_000;

export interface SimulationOptions {
  startTimestamp: number; // instante real (ms) em que o trecho começa
  clockMsPerSecond?: number; // quanto o relógio real anda por segundo simulado
  random?: RandomSource;
  onEvent?: (event: CombatEvent) => void;
}

// Tudo que as funções internas precisam, para não passar seis parâmetros adiante
interface SimulationContext {
  state: GameState;
  summary: SimulationSummary;
  random: RandomSource;
  emit: (event: CombatEvent) => void;
  modifiersByPhase: Record<DayPhase, Modifiers>;
  timestamp: number; // instante real correspondente ao ponto atual da simulação
}


// =============================================================================
// =============================================================================
// A V A N Ç O   D A   S I M U L A Ç Ã O

// Simula "seconds" segundos de combate e devolve o resumo do que aconteceu
export function advanceSimulation(
  state: GameState,
  seconds: number,
  options: SimulationOptions,
): SimulationSummary {
  const context = createContext(state, options);
  const canSimulate = state.party.length > 0 && seconds > 0;

  if (!canSimulate) {
    return context.summary;
  }

  const clockMsPerSecond = options.clockMsPerSecond ?? MS_PER_SECOND;
  let remainingSeconds = seconds;
  let iterations = 0;

  while (remainingSeconds > TIME_EPSILON && iterations < MAX_ITERATIONS) {
    const stepSeconds = runNextStep(context, remainingSeconds);
    context.timestamp += stepSeconds * clockMsPerSecond;
    remainingSeconds -= stepSeconds;
    iterations += 1;
  }

  const simulatedSeconds = seconds - Math.max(remainingSeconds, 0);
  context.summary.seconds = simulatedSeconds;
  state.stats.playTimeSeconds += simulatedSeconds;
  return context.summary;
}

// Anda até o próximo evento, resolve o que ficou pronto e devolve quanto tempo passou
function runNextStep(context: SimulationContext, remainingSeconds: number): number {
  const { state } = context;
  const modifiers = context.modifiersByPhase[getDayPhase(context.timestamp)];
  const stepSeconds = Math.min(remainingSeconds, getSecondsToNextEvent(state, modifiers));

  advanceTimers(state, modifiers, stepSeconds);
  resolveReadyAttacks(context, modifiers);
  resolveBossTimeout(context);
  return stepSeconds;
}

// Monta o contexto de um trecho simulado
function createContext(state: GameState, options: SimulationOptions): SimulationContext {
  return {
    state,
    summary: createEmptySummary(),
    random: options.random ?? Math.random,
    emit: options.onEvent ?? ignoreEvent,
    modifiersByPhase: getModifiersByPhase(state),
    timestamp: options.startTimestamp,
  };
}

// Usada quando ninguém quer ouvir os eventos (simulação offline)
function ignoreEvent(): void {}


// =============================================================================
// =============================================================================
// T E M P O

// Segundos até o próximo golpe ou até acabar o tempo do chefe, o que vier antes
function getSecondsToNextEvent(state: GameState, modifiers: Modifiers): number {
  let secondsToNextEvent = Infinity;

  for (const encantadoId of state.party) {
    const interval = getAttackInterval(getEncantado(encantadoId), modifiers);
    const progress = state.combat.attackProgress[encantadoId] ?? 0;
    secondsToNextEvent = Math.min(secondsToNextEvent, (1 - progress) * interval);
  }

  if (state.combat.isBoss) {
    secondsToNextEvent = Math.min(secondsToNextEvent, state.combat.bossTimeLeft);
  }

  return Math.max(secondsToNextEvent, MIN_STEP_SECONDS);
}

// Enche as barras de ataque e desconta o tempo do chefe
function advanceTimers(state: GameState, modifiers: Modifiers, stepSeconds: number): void {
  for (const encantadoId of state.party) {
    const interval = getAttackInterval(getEncantado(encantadoId), modifiers);
    const progress = state.combat.attackProgress[encantadoId] ?? 0;
    state.combat.attackProgress[encantadoId] = progress + stepSeconds / interval;
  }

  if (state.combat.isBoss) {
    state.combat.bossTimeLeft -= stepSeconds;
  }
}


// =============================================================================
// =============================================================================
// G O L P E S

// Dispara o golpe de cada encantado cuja barra encheu
function resolveReadyAttacks(context: SimulationContext, modifiers: Modifiers): void {
  const { combat, party } = context.state;

  for (const encantadoId of party) {
    const isReady = (combat.attackProgress[encantadoId] ?? 0) >= 1 - TIME_EPSILON;

    if (isReady) {
      combat.attackProgress[encantadoId] = 0;
      performAttack(context, encantadoId, modifiers);
    }
  }
}

// Aplica o dano de um golpe e, se a vida zerar, resolve a derrota do inimigo
function performAttack(
  context: SimulationContext,
  encantadoId: string,
  modifiers: Modifiers,
): void {
  const { state, random, emit } = context;
  const encantado = getEncantado(encantadoId);
  const level = state.roster[encantadoId].level;
  const baseDamage = getAttackDamage(encantado, level, modifiers, state.combat.isBoss);
  const isCrit = rollChance(modifiers.critChance, random);
  const damage = isCrit ? baseDamage * BALANCE.critMultiplier : baseDamage;

  state.combat.enemyHp = Math.max(0, state.combat.enemyHp - damage);
  emit({ type: 'hit', attackerId: encantadoId, damage, isCrit });

  if (state.combat.enemyHp <= 0) {
    handleEnemyDefeated(context, modifiers);
  }
}


// =============================================================================
// =============================================================================
// D E R R O T A   D E   I N I M I G O S   E   C H E F E S

// Entrega as recompensas e decide quem entra em campo depois
function handleEnemyDefeated(context: SimulationContext, modifiers: Modifiers): void {
  const { combat } = context.state;
  const wasBoss = combat.isBoss;

  grantKillRewards(context, getEnemy(combat.enemyId), modifiers);

  if (wasBoss) {
    handleBossDefeated(context);
  } else {
    handleCommonEnemyDefeated(context);
  }
}

// Conta a visagem derrotada e chama o chefe quando a contagem fecha
function handleCommonEnemyDefeated(context: SimulationContext): void {
  const { state, random, emit } = context;
  const zone = getZoneForStage(state.stage);

  state.killsInStage = Math.min(state.killsInStage + 1, zone.killsToBoss);
  const isBossDue = state.autoProgress && state.killsInStage >= zone.killsToBoss;

  if (isBossDue) {
    spawnBoss(state);
    emit({ type: 'bossAppeared', enemyId: zone.bossId });
  } else {
    spawnCommonEnemy(state, random);
  }
}

// Libera o próximo estágio e avança se o avanço automático estiver ligado
function handleBossDefeated(context: SimulationContext): void {
  const { state, summary, random, emit } = context;

  summary.bossesDefeated += 1;
  state.stats.bossesDefeated += 1;
  state.maxStage = Math.max(state.maxStage, state.stage + 1);
  state.killsInStage = 0;

  if (state.autoProgress) {
    state.stage += 1;
    summary.stagesAdvanced += 1;
    emit({ type: 'stageAdvanced', stage: state.stage });
  }

  spawnCommonEnemy(state, random);
}

// Se o tempo do chefe acabou com ele vivo, a comitiva volta a juntar visagens
function resolveBossTimeout(context: SimulationContext): void {
  const { state, summary, random, emit } = context;
  const hasTimedOut = state.combat.isBoss && state.combat.bossTimeLeft <= TIME_EPSILON;

  if (!hasTimedOut) {
    return;
  }

  summary.bossesFailed += 1;
  state.killsInStage = 0;
  emit({ type: 'bossFailed', enemyId: state.combat.enemyId });
  spawnCommonEnemy(state, random);
}


// =============================================================================
// =============================================================================
// R E C O M P E N S A S

// Patacas, XP, Oferendas e Rastros de um inimigo derrotado
function grantKillRewards(context: SimulationContext, enemy: EnemyDef, modifiers: Modifiers): void {
  const { state, summary, emit } = context;
  const { isBoss } = state.combat;
  const gold = getGoldReward(state.stage, enemy, isBoss, modifiers.gold);
  const xp = getXpReward(state.stage, enemy, isBoss);

  state.gold += gold;
  state.stats.totalGoldEarned += gold;
  state.stats.totalKills += 1;
  summary.gold += gold;
  summary.xp += xp;
  summary.kills += 1;
  emit({ type: 'kill', enemyId: enemy.id, isBoss, gold, xp });

  grantXpToParty(context, xp);
  rollItemDrops(context, enemy, modifiers);
  rollTrails(context, modifiers);
}

// Cada encantado da comitiva recebe o XP inteiro e sobe de nível quando junta o bastante
function grantXpToParty(context: SimulationContext, xp: number): void {
  const { state, summary, emit } = context;

  for (const encantadoId of state.party) {
    const owned = state.roster[encantadoId];
    owned.xp += xp;

    while (owned.xp >= getXpToNextLevel(owned.level)) {
      owned.xp -= getXpToNextLevel(owned.level);
      owned.level += 1;
      summary.levelUps[encantadoId] = (summary.levelUps[encantadoId] ?? 0) + 1;
      emit({ type: 'levelUp', encantadoId, level: owned.level });
    }
  }
}

// Sorteia cada Oferenda da tabela do inimigo
function rollItemDrops(context: SimulationContext, enemy: EnemyDef, modifiers: Modifiers): void {
  const { state, summary, random, emit } = context;

  for (const drop of enemy.drops) {
    const chance = Math.min(1, drop.chance * modifiers.dropChance);

    if (rollChance(chance, random)) {
      const amount = randomInteger(drop.min, drop.max, random);
      state.inventory[drop.itemId] = (state.inventory[drop.itemId] ?? 0) + amount;
      summary.items[drop.itemId] = (summary.items[drop.itemId] ?? 0) + amount;
      emit({ type: 'drop', itemId: drop.itemId, amount });
    }
  }
}

// Sorteia Rastros dos encantados da zona que ainda não entraram na comitiva
function rollTrails(context: SimulationContext, modifiers: Modifiers): void {
  const { state, summary, random, emit, timestamp } = context;
  const zone = getZoneForStage(state.stage);

  for (const encounter of zone.encounters) {
    const { encantadoId } = encounter;
    const chance = Math.min(1, encounter.trailChance * modifiers.dropChance);
    const isClockRight = matchesClock(encounter, timestamp);
    const canFindTrail = isClockRight && isTrailStillNeeded(state, encantadoId);

    if (canFindTrail && rollChance(chance, random)) {
      state.trails[encantadoId] = (state.trails[encantadoId] ?? 0) + 1;
      summary.trails[encantadoId] = (summary.trails[encantadoId] ?? 0) + 1;
      emit({ type: 'trail', encantadoId });
    }
  }
}

// Rastro só aparece para quem ainda não tem pacto e ainda não juntou o bastante
function isTrailStillNeeded(state: GameState, encantadoId: string): boolean {
  const pact = getEncantado(encantadoId).pact;
  const isOwned = encantadoId in state.roster;

  if (isOwned || pact === null) {
    return false;
  }

  return (state.trails[encantadoId] ?? 0) < pact.trailsNeeded;
}
