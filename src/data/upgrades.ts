/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/upgrades.ts
 * O que faz: lista as melhorias compradas com Patacas.
 * Custo = baseCost × costFactor^nível. Bônus = bonusPerLevel × nível.
 */

import type { UpgradeDef } from '../domain/types';

// =============================================================================
// =============================================================================
// M E L H O R I A S

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'reza-forte',
    name: 'Reza forte',
    description: '+10% de dano por nível.',
    baseCost: 10,
    costFactor: 1.15,
    stat: 'damage',
    bonusPerLevel: 0.1,
  },
  {
    id: 'passo-ligeiro',
    name: 'Passo ligeiro',
    description: '+2% de velocidade de ataque por nível.',
    baseCost: 25,
    costFactor: 1.22,
    stat: 'attackSpeed',
    bonusPerLevel: 0.02,
    maxLevel: 50,
  },
  {
    id: 'bolsa-de-couro',
    name: 'Bolsa de couro',
    description: '+10% de Patacas por nível.',
    baseCost: 40,
    costFactor: 1.18,
    stat: 'gold',
    bonusPerLevel: 0.1,
  },
  {
    id: 'olho-de-mateiro',
    name: 'Olho de mateiro',
    description: '+3% de chance de Oferenda e de Rastro por nível.',
    baseCost: 60,
    costFactor: 1.25,
    stat: 'dropChance',
    bonusPerLevel: 0.03,
    maxLevel: 25,
  },
];
