/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/zones.ts
 * O que faz: lista as zonas na ordem em que aparecem. Os estágios são
 * contados em sequência: a primeira zona ocupa os estágios 1 a stageCount,
 * a segunda continua daí. A última zona da lista não tem fim.
 */

import type { ZoneDef } from '../domain/types';

// =============================================================================
// =============================================================================
// Z O N A S

export const ZONES: ZoneDef[] = [
  {
    id: 'mata-atlantica',
    biome: 'mata-atlantica',
    name: 'Mata Atlântica',
    stageCount: 10,
    enemyIds: ['visagem-da-neblina', 'vulto-da-capoeira', 'assombro-do-brejo'],
    bossId: 'corpo-seco',
    killsToBoss: 10,
    bossTimeLimit: 30,
    encounters: [
      { encantadoId: 'caipora', trailChance: 0.12 },
      { encantadoId: 'boitata', trailChance: 0.08, dayPhase: 'noite' },
    ],
  },
];
