/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/world.ts
 * O que faz: os dados do mundo aberto: os tipos de ladrilho e os mapas.
 *
 * Como ler um mapa: cada texto de "layout" é uma linha do mapa e cada
 * caractere é um ladrilho, conforme a legenda de TILES. A coluna conta da
 * esquerda (0) para a direita e a linha conta de cima (0) para baixo. As
 * passagens (portals) ficam por cima do desenho, em ladrilhos que dá para pisar.
 *
 * As imagens de cada ladrilho ainda não existem. O nome do arquivo de cada
 * uma fica em src/components/world/sprites.ts.
 *
 * Mapa:
 *   1. Ladrilhos
 *   2. Mapas
 */

import type { TileDef, WorldMapDef } from '../domain/types';

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

// O primeiro mapa da lista é onde todo jogo novo começa
export const WORLD_MAPS: WorldMapDef[] = [
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
    enemyIds: ['visagem-da-neblina', 'vulto-da-capoeira'],
    maxEnemies: 6,
    portals: [{ x: 30, y: 10, toMapId: 'brejo-escuro', toX: 2, toY: 10 }],
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
    start: { x: 2, y: 10 },
    enemyIds: ['assombro-do-brejo', 'vulto-da-capoeira'],
    maxEnemies: 8,
    portals: [{ x: 1, y: 10, toMapId: 'beira-da-mata', toX: 29, toY: 10 }],
  },
];
