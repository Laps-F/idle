/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/amulets.ts
 * O que faz: as tabelas dos amuletos. Uma lista com os tipos de amuleto (o
 * que cada um fortalece) e uma tabela de raridades (peso no sorteio, força,
 * bônus secundários, limite de entalhe e valor de desmanche).
 *
 * As chances de queda e as constantes das fórmulas ficam em src/data/balance.ts.
 * As regras ficam em src/domain/amulets.ts.
 *
 * Mapa:
 *   1. Tipos de amuleto
 *   2. Raridades
 */

import type { AmuletBaseDef, AmuletRarityDef } from '../domain/types';

// =============================================================================
// =============================================================================
// T I P O S   D E   A M U L E T O

// Cada tipo fortalece um atributo. "baseBonus" é o bônus de um amuleto comum,
// caído no estágio 1 e sem entalhe. Raridade, estágio e entalhe multiplicam esse valor.
export const AMULET_BASES: AmuletBaseDef[] = [
  {
    id: 'figa',
    name: 'Figa de guiné',
    description: 'Mão fechada, talhada em madeira escura. Dá mais força a cada golpe.',
    stat: 'damage',
    baseBonus: 0.12,
  },
  {
    id: 'guizo',
    name: 'Guizo de cascavel',
    description: 'Chocalha sozinho quando o perigo chega. Apressa a mão de quem luta.',
    stat: 'attackSpeed',
    baseBonus: 0.05,
  },
  {
    id: 'moeda-furada',
    name: 'Moeda furada',
    description: 'Pataca velha, com um furo no meio. Dinheiro chama dinheiro.',
    stat: 'gold',
    baseBonus: 0.12,
  },
  {
    id: 'olho-de-boi',
    name: 'Olho-de-boi',
    description: 'Semente grande e lustrosa, que enxerga o que o mato esconde.',
    stat: 'dropChance',
    baseBonus: 0.08,
  },
  {
    id: 'ferradura',
    name: 'Ferradura',
    description: 'Achada na estrada, de pontas para cima. Guarda a sorte do golpe certeiro.',
    stat: 'critChance',
    baseBonus: 0.03,
  },
  {
    id: 'espinho-de-mandacaru',
    name: 'Espinho de mandacaru',
    description: 'Comprido e duro, do cacto que aguenta a seca. Fura até o couro de um chefe.',
    stat: 'bossDamage',
    baseBonus: 0.15,
  },
];


// =============================================================================
// =============================================================================
// R A R I D A D E S

// Da mais comum para a mais rara. A ordem desta tabela é a ordem das raridades no jogo.
// Os pesos somam 100, então cada peso é a chance em porcentagem.
export const AMULET_RARITIES: AmuletRarityDef[] = [
  {
    rarity: 'comum',
    weight: 62,
    bonusMultiplier: 1,
    extraBonuses: 0,
    maxLevel: 5,
    salvageValue: 1,
    carveCostMultiplier: 1,
  },
  {
    rarity: 'raro',
    weight: 27,
    bonusMultiplier: 1.6,
    extraBonuses: 1,
    maxLevel: 10,
    salvageValue: 3,
    carveCostMultiplier: 2,
  },
  {
    rarity: 'epico',
    weight: 9,
    bonusMultiplier: 2.5,
    extraBonuses: 2,
    maxLevel: 15,
    salvageValue: 9,
    carveCostMultiplier: 4,
  },
  {
    rarity: 'lendario',
    weight: 2,
    bonusMultiplier: 4,
    extraBonuses: 3,
    maxLevel: 20,
    salvageValue: 30,
    carveCostMultiplier: 8,
  },
];
