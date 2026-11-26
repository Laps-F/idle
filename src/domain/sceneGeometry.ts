/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/sceneGeometry.ts
 * O que faz: a geometria do mapa da expedição: pontos, distâncias, centro de
 * ladrilho, se um corpo cabe num lugar sem encostar em árvore ou água e quais
 * ladrilhos estão livres.
 *
 * Quem usa: src/domain/expeditionScene.ts (personagem e visagens) e
 * src/domain/expeditionProjectiles.ts (voo dos projéteis).
 *
 * Coordenadas em ladrilhos: x conta da esquerda para a direita e y de cima para
 * baixo. O ladrilho (coluna, linha) vai de (coluna, linha) até (coluna + 1,
 * linha + 1), e o centro dele fica em (coluna + 0,5, linha + 0,5).
 *
 * Funções puras, sem estado.
 *
 * Mapa:
 *   1. Tipos e constantes
 *   2. Ladrilhos livres
 *   3. Pontos e distâncias
 */

import { BALANCE } from '../data/balance';
import { getMapSize, getTileAt } from './catalog';
import type { ExpeditionMapDef, ExpeditionScene } from './types';

// =============================================================================
// =============================================================================
// T I P O S   E   C O N S T A N T E S

// Folga para erro de arredondamento ao comparar tempos, distâncias e progressos
export const SCENE_EPSILON = 1e-9;

// Um ponto do mapa, em ladrilhos
export interface Point {
  x: number;
  y: number;
}


// =============================================================================
// =============================================================================
// L A D R I L H O S   L I V R E S

/**
 * Diz se um corpo redondo cabe num ponto do mapa sem encostar em árvore ou água.
 *
 * A conta é feita pelo quadrado em volta do corpo: os quatro cantos precisam
 * cair em ladrilhos que dá para pisar.
 *
 * @param map Mapa consultado.
 * @param x Centro do corpo, em ladrilhos.
 * @param y Centro do corpo, em ladrilhos.
 * @param radius Metade da largura do corpo. Padrão: bodyRadius de src/data/balance.ts.
 * @returns true se o ponto está livre. False fora do mapa ou com valor que não é número.
 */
export function isWalkablePosition(
  map: ExpeditionMapDef,
  x: number,
  y: number,
  radius: number = BALANCE.bodyRadius,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  const corners: Point[] = [
    { x: x - radius, y: y - radius },
    { x: x + radius, y: y - radius },
    { x: x - radius, y: y + radius },
    { x: x + radius, y: y + radius },
  ];

  return corners.every((corner) => {
    const tile = getTileAt(map, Math.floor(corner.x), Math.floor(corner.y));
    return tile !== null && !tile.isSolid;
  });
}

// Centro de todo ladrilho onde algo pode nascer: livre e fora da passagem de volta
export function listFreeTileCenters(map: ExpeditionMapDef): Point[] {
  const { width, height } = getMapSize(map);
  const spots: Point[] = [];

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const center = toTileCenter(column, row);
      const isExit = column === map.exit.x && row === map.exit.y;

      if (!isExit && isWalkablePosition(map, center.x, center.y)) {
        spots.push(center);
      }
    }
  }

  return spots;
}


// =============================================================================
// =============================================================================
// P O N T O S   E   D I S T Â N C I A S

// Posição da personagem como ponto
export function getPlayerPoint(scene: ExpeditionScene): Point {
  return { x: scene.playerX, y: scene.playerY };
}

// Centro de um ladrilho
export function toTileCenter(column: number, row: number): Point {
  return { x: column + 0.5, y: row + 0.5 };
}

// Distância em linha reta entre dois pontos
export function getDistance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

// Distância de um ponto até o trecho de reta entre "start" e "end"
export function getDistanceToSegment(point: Point, start: Point, end: Point): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared <= SCENE_EPSILON) {
    return getDistance(point, start);
  }

  const along = ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, along));
  return getDistance(point, { x: start.x + clamped * segmentX, y: start.y + clamped * segmentY });
}
