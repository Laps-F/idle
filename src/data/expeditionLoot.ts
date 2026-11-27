/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/expeditionLoot.ts
 * O que faz: o saque próprio de cada mapa de expedição: quanto cada visagem
 * da bolsa rende em Patacas e XP, que Oferendas ela pode deixar e a chance
 * de amuleto. Separado das quedas da clareira (src/data/enemies.ts).
 *
 * Como ler:
 *   - goldMultiplier e xpMultiplier multiplicam as fórmulas da clareira
 *     (src/data/balance.ts), com o nível da visagem no lugar do estágio. O
 *     multiplicador da própria visagem (goldMultiplier e xpMultiplier de
 *     src/data/enemies.ts) também entra.
 *   - drops vale para toda visagem do mapa, no lugar da tabela da visagem.
 *     A chance de achado da comitiva multiplica cada chance.
 *   - amuletChance é a chance de amuleto por visagem, no lugar de
 *     amuletCommonDropChance. A chance de achado também multiplica.
 *
 * Calibragem (27/11/2026, passo 6 do Caminho 2): com a clareira parada
 * durante a expedição, a meta é a bolsa render cerca de 2 vezes o que a
 * clareira renderia no mesmo tempo, e uma expedição completa, 3 vezes ou
 * mais. O fator do time (expeditionTeamLootBonus, em src/data/balance.ts)
 * multiplica por cima, quando sai mais de um. Medido com o robô de
 * tests/calibration.test.ts (npm run calibrate): mediana de 2 a 2,9 vezes,
 * completas de 2,5 a 3,5 vezes. Tabela no histórico (docs/HISTORICO.md).
 *
 * Todo mapa de src/data/world.ts precisa de uma entrada aqui (tests/data.test.ts).
 */

import type { ExpeditionLootDef } from '../domain/types';

// =============================================================================
// =============================================================================
// S A Q U E   D E   C A D A   M A P A

export const EXPEDITION_LOOT: ExpeditionLootDef[] = [
  {
    mapId: 'beira-da-mata',
    goldMultiplier: 5,
    xpMultiplier: 5,
    amuletChance: 0.06,
    drops: [
      { itemId: 'mel-silvestre', chance: 0.2, min: 1, max: 2 },
      { itemId: 'cipo-trancado', chance: 0.12, min: 1, max: 1 },
    ],
  },
  {
    mapId: 'brejo-escuro',
    goldMultiplier: 6.5,
    xpMultiplier: 6.5,
    amuletChance: 0.08,
    drops: [
      { itemId: 'cipo-trancado', chance: 0.2, min: 1, max: 2 },
      { itemId: 'mel-silvestre', chance: 0.1, min: 1, max: 1 },
      // A única fonte de brasa viva fora do Corpo-Seco da clareira
      { itemId: 'brasa-viva', chance: 0.04, min: 1, max: 1 },
    ],
  },
];
