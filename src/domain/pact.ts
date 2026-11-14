/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/pact.ts
 * O que faz: confere o que falta para fechar um pacto e fecha o pacto.
 * Pacto é o jeito de conquistar um encantado: Rastros, Oferendas e, às vezes,
 * a hora certa. Funções puras.
 *
 * Mapa:
 *   1. Situação do pacto
 *   2. Fechamento do pacto
 */

import { BALANCE } from '../data/balance';
import { getEncantado, hasEncantado } from './catalog';
import { matchesClock } from './clock';
import { createOwnedEncantado } from './state';
import type { GameState, PactRequirement } from './types';

// =============================================================================
// =============================================================================
// S I T U A Ç Ã O   D O   P A C T O

export interface OfferingProgress {
  itemId: string;
  owned: number;
  needed: number;
}

export interface PactStatus {
  encantadoId: string;
  isOwned: boolean;
  trailsOwned: number;
  trailsNeeded: number;
  offerings: OfferingProgress[];
  isClockRight: boolean;
  canSeal: boolean;
}

/**
 * Mostra o que já foi juntado e o que falta para o pacto com um encantado.
 *
 * @param state Estado do jogo. Só é lido.
 * @param encantadoId Id do encantado. Precisa existir em src/data/encantados.ts.
 * @param timestamp Instante atual em ms, para conferir a hora e a lua que o pacto pede.
 * @returns Situação do pacto. "canSeal" só é true com tudo juntado e na hora certa.
 * @throws Error se o id não existir nos dados.
 *
 * Caso de borda: encantado inicial não tem pacto. Para ele, "canSeal" é sempre false.
 */
export function getPactStatus(
  state: GameState,
  encantadoId: string,
  timestamp: number,
): PactStatus {
  const pact = getEncantado(encantadoId).pact;
  const isOwned = encantadoId in state.roster;
  const trailsOwned = state.trails[encantadoId] ?? 0;
  const trailsNeeded = pact?.trailsNeeded ?? 0;
  const offerings = getOfferingProgress(state, pact);
  const isClockRight = pact !== null && matchesClock(pact, timestamp);
  const hasEverything =
    trailsOwned >= trailsNeeded && offerings.every((offering) => offering.owned >= offering.needed);

  return {
    encantadoId,
    isOwned,
    trailsOwned,
    trailsNeeded,
    offerings,
    isClockRight,
    canSeal: pact !== null && !isOwned && hasEverything && isClockRight,
  };
}

// Quanto de cada Oferenda pedida já está no inventário
function getOfferingProgress(state: GameState, pact: PactRequirement | null): OfferingProgress[] {
  const offerings = pact?.offerings ?? [];

  return offerings.map((offering) => ({
    itemId: offering.itemId,
    owned: state.inventory[offering.itemId] ?? 0,
    needed: offering.amount,
  }));
}


// =============================================================================
// =============================================================================
// F E C H A M E N T O   D O   P A C T O

/**
 * Fecha o pacto: gasta os Rastros e as Oferendas e coloca o encantado no elenco.
 *
 * Função pura: não altera "state".
 *
 * @param state Estado de partida. Não é alterado.
 * @param encantadoId Id do encantado.
 * @param timestamp Instante atual em ms, para conferir a hora e a lua.
 * @returns Estado novo com o encantado no elenco, ou null se o pacto não pode ser fechado.
 *
 * Casos de borda: devolve null para id que não existe, encantado inicial,
 * encantado que já está no elenco, falta de Rastros ou Oferendas e hora errada.
 * O encantado novo entra na comitiva se houver vaga. Se não houver, fica só no elenco.
 */
export function sealPact(
  state: GameState,
  encantadoId: string,
  timestamp: number,
): GameState | null {
  if (!hasEncantado(encantadoId)) {
    return null;
  }

  const status = getPactStatus(state, encantadoId, timestamp);

  if (!status.canSeal) {
    return null;
  }

  const afterPayment: GameState = {
    ...state,
    inventory: spendOfferings(state.inventory, status.offerings),
    trails: removeKey(state.trails, encantadoId),
    roster: { ...state.roster, [encantadoId]: createOwnedEncantado(encantadoId) },
  };

  return joinPartyIfThereIsRoom(afterPayment, encantadoId);
}

// Inventário novo, sem as Oferendas gastas no pacto
function spendOfferings(
  inventory: Record<string, number>,
  offerings: readonly OfferingProgress[],
): Record<string, number> {
  const remaining = { ...inventory };

  for (const offering of offerings) {
    remaining[offering.itemId] = offering.owned - offering.needed;
  }

  return remaining;
}

// Cópia do contador sem a chave informada
function removeKey(counters: Record<string, number>, key: string): Record<string, number> {
  return Object.fromEntries(Object.entries(counters).filter(([id]) => id !== key));
}

// O encantado novo já entra na comitiva quando sobra vaga
function joinPartyIfThereIsRoom(state: GameState, encantadoId: string): GameState {
  const hasRoom = state.party.length < BALANCE.maxPartySize;

  if (!hasRoom) {
    return state;
  }

  const attackProgress = { ...state.combat.attackProgress, [encantadoId]: 0 };
  return {
    ...state,
    party: [...state.party, encantadoId],
    combat: { ...state.combat, attackProgress },
  };
}
