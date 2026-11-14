/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/engine/offline.ts
 * O que faz: calcula o que a comitiva conquistou enquanto o jogo estava
 * fechado. Em vez de estimar, roda a mesma simulação do jogo aberto, com
 * teto de tempo e eficiência reduzida.
 *
 * Mapa:
 *   1. Progresso offline
 *   2. Junção de relatórios
 */

import { BALANCE, MS_PER_SECOND } from '../data/balance';
import type { GameState, OfflineReport, RandomSource, SimulationSummary } from '../types/game';
import { advanceSimulation } from './simulation';

// Contador do tipo { id: quantidade }
type Counters = Record<string, number>;

// =============================================================================
// =============================================================================
// P R O G R E S S O   O F F L I N E

// Simula o tempo ausente, altera o estado e devolve o relatório. Null se não havia comitiva.
export function applyOfflineProgress(
  state: GameState,
  now: number,
  random: RandomSource = Math.random,
): OfflineReport | null {
  const startTimestamp = state.lastSaveTimestamp;
  const secondsAway = (now - startTimestamp) / MS_PER_SECOND;
  state.lastSaveTimestamp = now;

  if (state.party.length === 0 || secondsAway <= 0) {
    return null;
  }

  // Cada segundo simulado vale mais de um segundo real, e o relógio do sertão acompanha
  const secondsSimulated = getOfflineSimulatedSeconds(secondsAway);
  const clockMsPerSecond = MS_PER_SECOND / BALANCE.offlineEfficiency;
  const summary = advanceSimulation(state, secondsSimulated, {
    startTimestamp,
    clockMsPerSecond,
    random,
  });

  return { secondsAway, secondsSimulated, summary };
}

// Tempo que rende = menor(tempo ausente, teto) × eficiência
export function getOfflineSimulatedSeconds(secondsAway: number): number {
  const cappedSeconds = Math.min(secondsAway, BALANCE.offlineCapSeconds);
  return cappedSeconds * BALANCE.offlineEfficiency;
}


// =============================================================================
// =============================================================================
// J U N Ç Ã O   D E   R E L A T Ó R I O S

// Soma um relatório novo a um que a pessoa ainda não fechou
export function mergeOfflineReports(
  previous: OfflineReport | null,
  next: OfflineReport,
): OfflineReport {
  if (previous === null) {
    return next;
  }

  return {
    secondsAway: previous.secondsAway + next.secondsAway,
    secondsSimulated: previous.secondsSimulated + next.secondsSimulated,
    summary: mergeSummaries(previous.summary, next.summary),
  };
}

// Soma dois resumos, campo por campo
function mergeSummaries(first: SimulationSummary, second: SimulationSummary): SimulationSummary {
  return {
    seconds: first.seconds + second.seconds,
    gold: first.gold + second.gold,
    xp: first.xp + second.xp,
    kills: first.kills + second.kills,
    bossesDefeated: first.bossesDefeated + second.bossesDefeated,
    bossesFailed: first.bossesFailed + second.bossesFailed,
    stagesAdvanced: first.stagesAdvanced + second.stagesAdvanced,
    items: mergeCounters(first.items, second.items),
    trails: mergeCounters(first.trails, second.trails),
    levelUps: mergeCounters(first.levelUps, second.levelUps),
  };
}

// Soma dois contadores do tipo { id: quantidade }
function mergeCounters(first: Counters, second: Counters): Counters {
  const merged = { ...first };

  for (const [id, amount] of Object.entries(second)) {
    merged[id] = (merged[id] ?? 0) + amount;
  }

  return merged;
}
