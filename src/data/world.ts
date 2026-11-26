/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/world.ts
 * O que faz: os dados dos mapas de expedição: os tipos de ladrilho e os mapas.
 * O ritmo das ondas, o tempo da expedição e a força das visagens ficam em
 * src/data/balance.ts, no bloco "Expedições".
 *
 * Como ler um mapa: cada texto de "layout" é uma linha do mapa e cada
 * caractere é um ladrilho, conforme a legenda de TILES. A coluna conta da
 * esquerda (0) para a direita e a linha conta de cima (0) para baixo. A
 * passagem de volta para a clareira (exit) fica por cima do desenho, num
 * ladrilho que dá para pisar.
 *
 * As imagens de cada ladrilho ainda não existem. O nome do arquivo de cada
 * uma fica em src/components/world/sprites.ts.
 *
 * Mapa:
 *   1. Ladrilhos
 *   2. Mapas
 */

import type { ExpeditionMapDef, TileDef } from '../domain/types';

// =============================================================================
// =============================================================================
// L A D R I L H O S

export const TILES: TileDef[] = [
  { id: 'grama', symbol: '.', name: 'Grama', isSolid: false },
  { id: 'trilha', symbol: ':', name: 'Trilha', isSolid: false },
  { id: 'arvore', symbol: 'T', name: 'Árvore', isSolid: true },
  { id: 'agua', symbol: '~', name: 'Água', isSolid: true },
];


// =============================================================================
// =============================================================================
// M A P A S

// Aparecem na aba "Expedições" da clareira, nesta ordem
export const EXPEDITION_MAPS: ExpeditionMapDef[] = [
  {
    id: 'beira-da-mata',
    name: 'Beira da Mata',
    zoneId: 'mata-atlantica',
    level: 1,
    layout: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T.....T..............T.........T',
      'T..TT..........TT..........TT..T',
      'T..TT..........TT..........TT..T',
      'T.......~~~~...................T',
      'T......~~~~~~.........T........T',
      'T.......~~~~.........TTT.......T',
      'T.....................T........T',
      'T....TT........................T',
      'T....TT.......::::::::::.......T',
      'T.::::::::::::::......::::::::.T',
      'T..............................T',
      'T.........TT...........TT......T',
      'T.........TT...........TT......T',
      'T..............~~~.............T',
      'T...TT........~~~~~.......TT...T',
      'T...TT.........~~~........TT...T',
      'T..............................T',
      'T........T..........T..........T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    start: { x: 4, y: 10 },
    exit: { x: 1, y: 10 },
    enemyIds: ['visagem-da-neblina', 'vulto-da-capoeira'],
  },
  {
    id: 'brejo-escuro',
    name: 'Brejo Escuro',
    zoneId: 'mata-atlantica',
    level: 4,
    layout: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T~~~...........T......~~~~~~~~~T',
      'T~~.....~~~...........~~~~~~~~~T',
      'T......~~~~~......TT....~~~~~~~T',
      'T.......~~~.......TT......~~~~~T',
      'T...................~~.......~~T',
      'T...TT.............~~~~.......~T',
      'T...TT..............~~........~T',
      'T.............................~T',
      'T..::::::.....................~T',
      'T.:::..::::::::...............~T',
      'T..............:::::..........~T',
      'T.......~~~~.......:::........~T',
      'T......~~~~~~.................~T',
      'T.......~~~~.......TT........~~T',
      'T..TT..............TT.......~~~T',
      'T..TT......................~~~~T',
      'T~~.......T........~~~....~~~~~T',
      'T~~~~...........~~~~~~~..~~~~~~T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    start: { x: 4, y: 10 },
    exit: { x: 1, y: 10 },
    enemyIds: ['assombro-do-brejo', 'vulto-da-capoeira'],
  },
];
