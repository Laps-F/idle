/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/gifts.ts
 * O que faz: o dom de cada encantado. O dom vale enquanto o encantado está na
 * comitiva, como as sinergias, e soma na conta de src/domain/modifiers.ts.
 * Decidido em 27/11/2026 (Caminho 2, estudo da comitiva): com um dom
 * diferente para cada um, montar a comitiva passa a ser escolher o que se
 * quer (Patacas, Oferendas, Rastros, chefes), e não só o maior dano.
 *
 * Como ler:
 *   - stat: o que o dom aumenta. Os atributos de ModifierStat (src/domain/types.ts)
 *     e também trailChance (Rastro) e itemChance (Oferenda).
 *   - bonus: quanto soma, como fração (0,15 é +15%). Vira um fator próprio,
 *     (1 + bonus), que multiplica o resto (melhorias, sinergias, amuletos).
 *   - Vale onde a comitiva estiver: na clareira e, como a comitiva inteira
 *     sai, também na expedição (velocidade e chance de Rastro, por exemplo).
 *
 * Todo encantado precisa de um dom aqui (tests/data.test.ts).
 *
 * Mapa:
 *   1. Dons
 */

import type { GiftDef } from '../domain/types';

// =============================================================================
// =============================================================================
// D O N S

export const GIFTS: GiftDef[] = [
  {
    encantadoId: 'saci',
    name: 'Ligeireza',
    description: '+10% de velocidade de ataque da comitiva.',
    stat: 'attackSpeed',
    bonus: 0.1,
  },
  {
    encantadoId: 'curupira',
    name: 'Dono da mata',
    description: '+15% de chance de Oferenda.',
    stat: 'itemChance',
    bonus: 0.15,
  },
  {
    encantadoId: 'iara',
    name: 'Brilho do rio',
    description: '+15% de Patacas.',
    stat: 'gold',
    bonus: 0.15,
  },
  {
    encantadoId: 'caipora',
    name: 'Faro de caça',
    description: '+15% de chance de Rastro.',
    stat: 'trailChance',
    bonus: 0.15,
  },
  {
    encantadoId: 'boitata',
    name: 'Fogo que guarda',
    description: '+20% de dano contra chefes.',
    stat: 'bossDamage',
    bonus: 0.2,
  },
];
