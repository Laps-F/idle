/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/engine/clock.ts
 * O que faz: o relógio do sertão. Dia, noite e lua saem direto do horário
 * do aparelho, sem guardar nada. Por isso funciona offline e sem servidor.
 *
 * Mapa:
 *   1. Constantes
 *   2. Dia e noite
 *   3. Lua
 *   4. Condições de hora
 */

import { BALANCE, MS_PER_SECOND } from '../data/balance';
import type { ClockRequirement, DayPhase, MoonPhase } from '../types/game';

// =============================================================================
// =============================================================================
// C O N S T A N T E S

// A primeira metade do dia do jogo é dia, a segunda é noite
const NIGHT_START = 0.5;

// Ordem das fases dentro de um ciclo da lua
const MOON_PHASES: MoonPhase[] = ['nova', 'crescente', 'cheia', 'minguante'];

export interface ClockInfo {
  dayPhase: DayPhase;
  moonPhase: MoonPhase;
  dayProgress: number; // de 0 a 1 dentro do dia do jogo
  secondsToNextDayPhase: number;
}


// =============================================================================
// =============================================================================
// D I A   E   N O I T E

// Posição dentro do dia do jogo, de 0 (começo do dia) a 1 (fim da noite)
export function getDayProgress(timestamp: number): number {
  const positionInDay = timestamp % BALANCE.dayLengthMs;
  return positionInDay / BALANCE.dayLengthMs;
}

// 'dia' ou 'noite' para o instante informado
export function getDayPhase(timestamp: number): DayPhase {
  return getDayProgress(timestamp) < NIGHT_START ? 'dia' : 'noite';
}

// Segundos reais até virar de dia para noite, ou de noite para dia
export function getSecondsToNextDayPhase(timestamp: number): number {
  const dayProgress = getDayProgress(timestamp);
  const nextChange = dayProgress < NIGHT_START ? NIGHT_START : 1;
  const remainingMs = (nextChange - dayProgress) * BALANCE.dayLengthMs;
  return remainingMs / MS_PER_SECOND;
}


// =============================================================================
// =============================================================================
// L U A

// Fase da lua para o instante informado
export function getMoonPhase(timestamp: number): MoonPhase {
  const dayIndex = Math.floor(timestamp / BALANCE.dayLengthMs);
  const dayInCycle = dayIndex % BALANCE.moonCycleDays;
  const daysPerPhase = BALANCE.moonCycleDays / MOON_PHASES.length;
  return MOON_PHASES[Math.floor(dayInCycle / daysPerPhase)];
}


// =============================================================================
// =============================================================================
// C O N D I Ç Õ E S   D E   H O R A

// Diz se a hora e a lua atendem à condição. Campo ausente na condição sempre atende.
export function matchesClock(requirement: ClockRequirement, timestamp: number): boolean {
  const isDayPhaseRight =
    requirement.dayPhase === undefined || requirement.dayPhase === getDayPhase(timestamp);
  const isMoonPhaseRight =
    requirement.moonPhase === undefined || requirement.moonPhase === getMoonPhase(timestamp);
  return isDayPhaseRight && isMoonPhaseRight;
}

// Retrato completo do relógio, pronto para a interface mostrar
export function getClockInfo(timestamp: number): ClockInfo {
  return {
    dayPhase: getDayPhase(timestamp),
    moonPhase: getMoonPhase(timestamp),
    dayProgress: getDayProgress(timestamp),
    secondsToNextDayPhase: getSecondsToNextDayPhase(timestamp),
  };
}
