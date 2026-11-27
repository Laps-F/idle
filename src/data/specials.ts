/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/specials.ts
 * O que faz: o golpe especial de cada encantado na expedição (tecla espaço).
 * Decidido em 27/11/2026 (Caminho 2, estudo da comitiva): cada encantado tem
 * um golpe próprio, puxado do folclore, para a comitiva ter papel no mapa.
 *
 * Como ler:
 *   - cooldownSeconds: recarga, antes do preparo (a Brasa no bornal encurta).
 *   - effects: o que o golpe faz, na ordem. Cada tipo está em SpecialEffect
 *     (src/domain/types.ts) e quem aplica é src/domain/expeditionSpecials.ts.
 *   - Os multiplicadores de dano contam sobre o dano do golpe comum de quem
 *     está em campo, e o preparo "Brasa no bornal" multiplica por cima.
 *   - Raios e distâncias em ladrilhos; tempos em segundos.
 *
 * Todo encantado precisa de um golpe aqui (tests/data.test.ts).
 *
 * Mapa:
 *   1. Golpes especiais
 */

import type { SpecialDef } from '../domain/types';

// =============================================================================
// =============================================================================
// G O L P E S   E S P E C I A I S

export const SPECIALS: SpecialDef[] = [
  {
    encantadoId: 'saci',
    name: 'Redemoinho',
    description: 'Some no vento por 1 segundo e empurra as visagens em volta.',
    cooldownSeconds: 6,
    effects: [
      { kind: 'invulnerable', seconds: 1 },
      { kind: 'push', radius: 2.5, distance: 2.5, damageMultiplier: 1 },
    ],
  },
  {
    encantadoId: 'curupira',
    name: 'Pés virados',
    description: 'Deixa pegadas ao contrário: as visagens por perto perdem a pista por 3 segundos.',
    cooldownSeconds: 8,
    effects: [{ kind: 'confuse', radius: 6, seconds: 3 }],
  },
  {
    encantadoId: 'iara',
    name: 'Canto da Iara',
    description: 'Um canto que acalma: recupera 25% da vida.',
    cooldownSeconds: 10,
    effects: [{ kind: 'heal', fraction: 0.25 }],
  },
  {
    encantadoId: 'caipora',
    name: 'Assobio',
    description: 'As visagens por perto ficam lentas por 4 segundos, e uma pegada aparece.',
    cooldownSeconds: 8,
    effects: [
      { kind: 'slow', radius: 4, seconds: 4, speedMultiplier: 0.4 },
      { kind: 'footprint' },
    ],
  },
  {
    encantadoId: 'boitata',
    name: 'Rastro de fogo',
    description: 'Uma labareda que atravessa as visagens e deixa todas queimando por 3 segundos.',
    cooldownSeconds: 6,
    effects: [{ kind: 'projectile', damageMultiplier: 4, burnDpsMultiplier: 0.5, burnSeconds: 3 }],
  },
];
