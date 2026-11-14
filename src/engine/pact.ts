/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/engine/pact.ts
 * O que faz: confere o que falta para fechar um pacto e fecha o pacto.
 * Pacto é o jeito de conquistar um encantado: Rastros, Oferendas e, às vezes,
 * a hora certa.
 *
 * Mapa:
 *   1. Situação do pacto
 *   2. Fechamento do pacto
 */

import { BALANCE } from '../data/balance';
import { getEncantado } from '../data';
import type { GameState, PactRequirement } from '../types/game';
import { matchesClock } from './clock';

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

// O que já foi juntado e o que falta para o pacto com o encantado
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

// Gasta Rastros e Oferendas e coloca o encantado no elenco. Devolve se deu certo.
export function sealPact(state: GameState, encantadoId: string, timestamp: number): boolean {
  const status = getPactStatus(state, encantadoId, timestamp);

  if (!status.canSeal) {
    return false;
  }

  for (const offering of status.offerings) {
    state.inventory[offering.itemId] -= offering.needed;
  }

  delete state.trails[encantadoId];
  state.roster[encantadoId] = { id: encantadoId, level: 1, xp: 0, bond: 0 };
  joinPartyIfThereIsRoom(state, encantadoId);
  return true;
}

// O encantado novo já entra na comitiva quando sobra vaga
function joinPartyIfThereIsRoom(state: GameState, encantadoId: string): void {
  const hasRoom = state.party.length < BALANCE.maxPartySize;

  if (hasRoom) {
    state.party.push(encantadoId);
    state.combat.attackProgress[encantadoId] = 0;
  }
}
