/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/enemies.ts
 * O que faz: lista as visagens (inimigos comuns) e os chefes.
 * Os multiplicadores são aplicados sobre as fórmulas de src/data/balance.ts.
 *
 * Mapa:
 *   1. Visagens da Mata Atlântica
 *   2. Chefes
 *   3. Lista completa
 */

import type { EnemyDef } from '../types/game';

// =============================================================================
// =============================================================================
// V I S A G E N S   D A   M A T A   A T L Â N T I C A

const MATA_ATLANTICA_ENEMIES: EnemyDef[] = [
  {
    id: 'visagem-da-neblina',
    name: 'Visagem da Neblina',
    hpMultiplier: 1,
    goldMultiplier: 1,
    xpMultiplier: 1,
    drops: [{ itemId: 'mel-silvestre', chance: 0.12, min: 1, max: 1 }],
  },
  {
    id: 'vulto-da-capoeira',
    name: 'Vulto da Capoeira',
    hpMultiplier: 1.25,
    goldMultiplier: 1.3,
    xpMultiplier: 1.2,
    drops: [{ itemId: 'cipo-trancado', chance: 0.15, min: 1, max: 2 }],
  },
  {
    id: 'assombro-do-brejo',
    name: 'Assombro do Brejo',
    hpMultiplier: 0.8,
    goldMultiplier: 0.8,
    xpMultiplier: 0.9,
    drops: [
      { itemId: 'mel-silvestre', chance: 0.08, min: 1, max: 1 },
      { itemId: 'cipo-trancado', chance: 0.08, min: 1, max: 1 },
    ],
  },
];


// =============================================================================
// =============================================================================
// C H E F E S

const BOSSES: EnemyDef[] = [
  {
    id: 'corpo-seco',
    name: 'Corpo-Seco',
    hpMultiplier: 1,
    goldMultiplier: 1,
    xpMultiplier: 1,
    drops: [
      { itemId: 'brasa-viva', chance: 0.5, min: 1, max: 1 },
      { itemId: 'mel-silvestre', chance: 1, min: 1, max: 2 },
    ],
  },
];


// =============================================================================
// =============================================================================
// L I S T A   C O M P L E T A

export const ENEMIES: EnemyDef[] = [...MATA_ATLANTICA_ENEMIES, ...BOSSES];
