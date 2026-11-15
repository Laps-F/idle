/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/offline.ts
 * O que faz: calcula o que a comitiva conquistou enquanto o jogo estava
 * fechado. Em vez de estimar, roda a mesma simulação do jogo aberto, com
 * teto de tempo e eficiência reduzida. Funções puras.
 *
 * Mapa:
 *   1. Progresso offline
 *   2. Junção de relatórios
 */

import { BALANCE, MS_PER_SECOND } from '../data/balance';
import type { RandomSource } from '../utils/random';
import { advanceSimulation } from './simulation';
import type { GameState, OfflineReport, OfflineResult, SimulationSummary } from './types';

// Contador do tipo { id: quantidade }
type Counters = Record<string, number>;

// =============================================================================
// =============================================================================
// P R O G R E S S O   O F F L I N E

/**
 * Calcula o progresso do tempo em que o jogo ficou fechado.
 *
 * O tempo ausente é o intervalo entre state.lastSaveTimestamp e "now". Ele é
 * limitado ao teto (offlineCapSeconds) e multiplicado pela eficiência
 * (offlineEfficiency). O resultado é o tempo que de fato é simulado, com a
 * mesma simulação do jogo aberto. O relógio do sertão acompanha o tempo real:
 * com eficiência de 50%, cada segundo simulado vale dois segundos de relógio.
 *
 * Função pura: não altera "state".
 *
 * @param state Estado salvo antes da ausência. Não é alterado.
 * @param now Instante atual em milissegundos.
 * @param random Fonte de números aleatórios da simulação.
 * @returns Estado novo, já com a marca de tempo em "now", e o relatório da ausência.
 *
 * Casos de borda:
 * - Sem comitiva: nada rende. O relatório é null e só a marca de tempo muda.
 * - "now" anterior à marca de tempo (relógio do aparelho voltou): nada rende.
 *   O relatório é null e a marca de tempo passa a ser "now".
 * - Ausência maior que o teto: só o teto rende. "secondsAway" mostra o tempo
 *   real e "secondsSimulated" mostra o que rendeu.
 */
export function applyOfflineProgress(
  state: GameState,
  now: number,
  random: RandomSource,
): OfflineResult {
  const startTimestamp = state.lastSaveTimestamp;
  const secondsAway = (now - startTimestamp) / MS_PER_SECOND;

  if (state.party.length === 0 || !(secondsAway > 0)) {
    return { state: { ...state, lastSaveTimestamp: now }, report: null };
  }

  const secondsSimulated = getOfflineSimulatedSeconds(secondsAway);
  const clockMsPerSecond = MS_PER_SECOND / BALANCE.offlineEfficiency;
  const result = advanceSimulation(state, secondsSimulated, {
    startTimestamp,
    clockMsPerSecond,
    random,
  });

  return {
    state: { ...result.state, lastSaveTimestamp: now },
    report: { secondsAway, secondsSimulated, summary: result.summary },
  };
}

// Diz se a ausência rendeu alguma coisa. Sem ganho, não há o que mostrar na volta.
export function hasOfflineGains(report: OfflineReport): boolean {
  return report.summary.kills > 0 || report.summary.gold > 0;
}

// Tempo que rende = menor(tempo ausente, teto) × eficiência
export function getOfflineSimulatedSeconds(secondsAway: number): number {
  const cappedSeconds = Math.min(secondsAway, BALANCE.offlineCapSeconds);
  return cappedSeconds * BALANCE.offlineEfficiency;
}


// =============================================================================
// =============================================================================
// J U N Ç Ã O   D E   R E L A T Ó R I O S

/**
 * Soma um relatório novo a um que a pessoa ainda não fechou.
 *
 * @param previous Relatório que já estava aberto, ou null se não havia nenhum.
 * @param next Relatório da ausência mais recente.
 * @returns Relatório com os tempos e os ganhos somados. Com "previous" null, devolve "next".
 */
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

// Soma dois contadores, sem alterar nenhum deles
function mergeCounters(first: Counters, second: Counters): Counters {
  const merged = { ...first };

  for (const [id, amount] of Object.entries(second)) {
    merged[id] = (merged[id] ?? 0) + amount;
  }

  return merged;
}
