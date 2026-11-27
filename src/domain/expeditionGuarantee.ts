/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionGuarantee.ts
 * O que faz: a garantia da clareira. Calcula quanto a clareira teria rendido
 * no tempo em que a expedição andou, para a volta pagar pelo menos isso.
 *
 * Regras (decididas em 27/11/2026, Caminho 2):
 *   - Durante a expedição, a clareira não rende nada, nem com a expedição
 *     pausada. A clareira só rende com a comitiva na clareira.
 *   - Em troca, a bolsa rende pelo menos as Patacas e o XP que a clareira
 *     teria rendido no tempo de expedição andado (sem as pausas), em qualquer
 *     desfecho. A diferença, se houver, entra como "Garantia da clareira".
 *   - A garantia não devolve estágios, Oferendas nem amuletos da clareira.
 *
 * Como calcula: roda a mesma simulação do jogo aberto (advanceSimulation),
 * numa cópia do estado, pelo tempo da expedição. O sorteio usa uma semente
 * tirada do instante da volta, para não mexer no sorteio da bolsa e dar
 * sempre o mesmo número para o mesmo instante. Cinco minutos de simulação
 * custam bem menos de 1 milissegundo.
 *
 * Função pura, sem estado.
 *
 * Mapa:
 *   1. Referência da clareira
 */

import { MS_PER_SECOND } from '../data/balance';
import { createSeededRandom } from '../utils/random';
import { advanceSimulation } from './simulation';
import type { GameState } from './types';

// =============================================================================
// =============================================================================
// R E F E R Ê N C I A   D A   C L A R E I R A

// O que a clareira teria rendido: o piso da bolsa
export interface ClearingReference {
  gold: number;
  xp: number; // XP de cada encantado da comitiva
}

/**
 * Quanto a clareira teria rendido em "seconds" de jogo aberto.
 *
 * @param state Estado da clareira antes de entregar a bolsa. Não é alterado.
 * @param seconds Tempo em que a expedição andou (ExpeditionScene.elapsedSeconds).
 * @param timestamp Instante da volta, em ms. Vira a semente do sorteio e o relógio
 *                  (dia, noite) da simulação, que começa "seconds" antes dele.
 * @returns Patacas e XP que a clareira teria rendido. Zero sem comitiva ou sem tempo.
 */
export function getClearingReference(
  state: GameState,
  seconds: number,
  timestamp: number,
): ClearingReference {
  if (!(seconds > 0) || state.party.length === 0) {
    return { gold: 0, xp: 0 };
  }

  const atClearing = { ...state, expedition: null };
  const result = advanceSimulation(atClearing, seconds, {
    startTimestamp: timestamp - seconds * MS_PER_SECOND,
    random: createSeededRandom(Math.floor(timestamp)),
  });

  return { gold: result.summary.gold, xp: result.summary.xp };
}
