/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionModifiers.ts
 * O que faz: os preparos da expedição e o objeto único que diz o que muda numa
 * partida (RunModifiers). Hoje só o preparo muda a partida. As bênçãos e a
 * esquiva da próxima etapa entram por aqui também, somando os seus
 * multiplicadores, sem mexer na cena.
 *
 * Regras dos preparos (decididas em 26/11/2026, Caminho 1):
 *   - Uma expedição usa no máximo um preparo, escolhido antes de partir.
 *   - O custo em Oferendas é pago ao partir e não volta.
 *   - Sem Oferendas bastantes, o preparo não pode ser escolhido.
 *
 * Funções puras, sem estado.
 *
 * Mapa:
 *   1. Modificadores da partida
 *   2. Preparos: custo e pagamento
 */

import { getExpeditionPreparation, hasExpeditionPreparation } from './catalog';
import type { GameState, RunModifiers } from './types';

// =============================================================================
// =============================================================================
// M O D I F I C A D O R E S   D A   P A R T I D A

// Partida sem nada que mude: tudo vale 1
export const NEUTRAL_RUN_MODIFIERS: Readonly<RunModifiers> = Object.freeze({
  playerSpeed: 1,
  specialDamage: 1,
  specialCooldown: 1,
  spawnRate: 1,
  maxEnemies: 1,
  footprintRate: 1,
  damageTaken: 1,
});

/**
 * O que muda numa partida, a partir do preparo escolhido.
 *
 * Cada fonte (hoje só o preparo) multiplica os valores da partida neutra.
 * Quando entrarem as bênçãos, elas multiplicam por cima do mesmo jeito.
 *
 * @param preparationId Preparo da expedição, ou null para nenhum.
 * @returns Modificadores novos (cópia). Preparo que não existe conta como nenhum.
 */
export function getRunModifiers(preparationId: string | null): RunModifiers {
  const modifiers: RunModifiers = { ...NEUTRAL_RUN_MODIFIERS };

  if (preparationId === null || !hasExpeditionPreparation(preparationId)) {
    return modifiers;
  }

  const changes = getExpeditionPreparation(preparationId).modifiers;

  for (const key of Object.keys(modifiers) as (keyof RunModifiers)[]) {
    modifiers[key] *= changes[key] ?? 1;
  }

  return modifiers;
}


// =============================================================================
// =============================================================================
// P R E P A R O S :   C U S T O   E   P A G A M E N T O

// Dá para pagar o preparo com as Oferendas guardadas. Preparo que não existe: não.
export function canAffordPreparation(state: GameState, preparationId: string): boolean {
  if (!hasExpeditionPreparation(preparationId)) {
    return false;
  }

  const { cost } = getExpeditionPreparation(preparationId);
  return Object.entries(cost).every(([itemId, amount]) => (state.inventory[itemId] ?? 0) >= amount);
}

/**
 * Paga o preparo: tira as Oferendas do inventário.
 *
 * @param state Estado do jogo. Não é alterado.
 * @param preparationId Preparo escolhido.
 * @returns Estado com as Oferendas descontadas, ou null se não der para pagar
 *          (preparo que não existe ou Oferendas de menos).
 */
export function payPreparation(state: GameState, preparationId: string): GameState | null {
  if (!canAffordPreparation(state, preparationId)) {
    return null;
  }

  const inventory = { ...state.inventory };

  for (const [itemId, amount] of Object.entries(getExpeditionPreparation(preparationId).cost)) {
    inventory[itemId] = (inventory[itemId] ?? 0) - amount;
  }

  return { ...state, inventory };
}
