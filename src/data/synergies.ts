/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/synergies.ts
 * O que faz: lista as sinergias de origem. Uma sinergia acende quando a
 * comitiva tem encantados suficientes da mesma origem.
 */

import type { SynergyDef } from '../domain/types';

// =============================================================================
// =============================================================================
// S I N E R G I A S   D E   O R I G E M

export const SYNERGIES: SynergyDef[] = [
  {
    origin: 'mata',
    name: 'Guarda da Mata',
    description: '+20% de chance de Oferenda e de Rastro.',
    membersNeeded: 2,
    stat: 'dropChance',
    bonus: 0.2,
  },
  {
    origin: 'agua',
    name: 'Maré Cheia',
    description: '+20% de Patacas.',
    membersNeeded: 2,
    stat: 'gold',
    bonus: 0.2,
  },
  {
    origin: 'vento',
    name: 'Redemoinho',
    description: '+15% de velocidade de ataque.',
    membersNeeded: 2,
    stat: 'attackSpeed',
    bonus: 0.15,
  },
  {
    origin: 'fogo',
    name: 'Fogo Corredor',
    description: '+25% de dano contra chefes.',
    membersNeeded: 2,
    stat: 'bossDamage',
    bonus: 0.25,
  },
  {
    origin: 'noite',
    name: 'Hora Morta',
    description: '+15% de chance de crítico durante a noite.',
    membersNeeded: 2,
    stat: 'critChance',
    bonus: 0.15,
    dayPhase: 'noite',
  },
];
