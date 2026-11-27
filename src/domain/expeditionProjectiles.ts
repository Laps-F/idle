/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionProjectiles.ts
 * O que faz: os projéteis da expedição: põe um projétil no mapa, faz cada um
 * voar, confere o acerto no caminho inteiro e tira do mapa o que acabou
 * (acertou, bateu em árvore ou água, ou andou a distância máxima).
 *
 * Quem decide quando um projétil sai (golpe comum e especial) e o que acontece
 * com a visagem acertada é src/domain/expeditionScene.ts. Este arquivo só voa e
 * avisa o acerto pela função "onHit".
 *
 * Regras:
 *   - O comum para na primeira visagem que acerta.
 *   - O especial atravessa todas, mas acerta cada uma uma vez só.
 *
 * Pureza: as funções recebem a cena de trabalho (o "draft" de advanceScene) e
 * alteram só ela, como o resto do passo da cena.
 *
 * Mapa:
 *   1. Tipos
 *   2. Disparo
 *   3. Voo e acerto
 */

import { BALANCE } from '../data/balance';
import {
  getDistance,
  getDistanceToSegment,
  isWalkablePosition,
  SCENE_EPSILON,
} from './sceneGeometry';
import type { Point } from './sceneGeometry';
import type { ExpeditionMapDef, ExpeditionScene, SceneEnemy, SceneProjectile } from './types';

// =============================================================================
// =============================================================================
// T I P O S

// O que um disparo precisa dizer
export interface LaunchOptions {
  isSpecial: boolean;
  direction: Point; // qualquer tamanho. Direção zero vira "para a direita".
  speed: number;
  maxDistance: number;
  damage: number;
  isCrit: boolean;
  burnDps?: number; // queimadura que deixa em quem acerta. Padrão: nenhuma.
  burnSeconds?: number;
}

// Avisa que um projétil acertou uma visagem. Quem chama tira a vida, cuida da derrota e
// aplica a queimadura do projétil, se houver.
export type ProjectileHit = (enemy: SceneEnemy, projectile: SceneProjectile) => void;


// =============================================================================
// =============================================================================
// D I S P A R O

// Põe um projétil no mapa, saindo do centro da personagem. Altera "draft".
export function launchProjectile(draft: ExpeditionScene, options: LaunchOptions): void {
  const length = Math.hypot(options.direction.x, options.direction.y);
  const projectile: SceneProjectile = {
    uid: draft.nextProjectileUid,
    isSpecial: options.isSpecial,
    x: draft.playerX,
    y: draft.playerY,
    directionX: length > SCENE_EPSILON ? options.direction.x / length : 1,
    directionY: length > SCENE_EPSILON ? options.direction.y / length : 0,
    speed: options.speed,
    remainingDistance: options.maxDistance,
    damage: options.damage,
    isCrit: options.isCrit,
    hitEnemyUids: [],
    burnDps: options.burnDps ?? 0,
    burnSeconds: options.burnSeconds ?? 0,
  };

  draft.nextProjectileUid += 1;
  draft.projectiles.push(projectile);
}


// =============================================================================
// =============================================================================
// V O O   E   A C E R T O

// Cada projétil voa um trecho. Os que acabaram (acerto, parede ou distância) saem do mapa.
export function updateProjectiles(
  draft: ExpeditionScene,
  map: ExpeditionMapDef,
  seconds: number,
  onHit: ProjectileHit,
): void {
  draft.projectiles = draft.projectiles.filter((projectile) =>
    flyProjectile(draft, map, projectile, seconds, onHit),
  );
}

/**
 * Faz um projétil voar um trecho e acertar as visagens no caminho.
 *
 * O acerto é conferido no segmento inteiro que o projétil percorreu no passo,
 * e não só no ponto final, para um projétil rápido não atravessar uma visagem
 * sem tocar nela. As visagens são acertadas da mais perto para a mais longe.
 *
 * @param draft Cena de trabalho. É lida para achar as visagens no caminho.
 * @param map Mapa da cena, para saber se o projétil bateu em árvore ou água.
 * @param projectile Projétil, alterado no lugar (é do draft).
 * @param seconds Duração do trecho.
 * @param onHit Chamada a cada acerto. Pode tirar a visagem do mapa.
 * @returns true se o projétil continua no mapa; false se acabou.
 */
function flyProjectile(
  draft: ExpeditionScene,
  map: ExpeditionMapDef,
  projectile: SceneProjectile,
  seconds: number,
  onHit: ProjectileHit,
): boolean {
  const distance = Math.min(projectile.speed * seconds, projectile.remainingDistance);
  const start = { x: projectile.x, y: projectile.y };
  const end = {
    x: start.x + projectile.directionX * distance,
    y: start.y + projectile.directionY * distance,
  };
  const hitRadius = BALANCE.bodyRadius + BALANCE.projectileRadius;
  const targets = draft.enemies
    .filter((enemy) => !projectile.hitEnemyUids.includes(enemy.uid))
    .filter((enemy) => getDistanceToSegment(enemy, start, end) <= hitRadius)
    .sort((first, second) => getDistance(first, start) - getDistance(second, start));

  for (const enemy of targets) {
    projectile.hitEnemyUids.push(enemy.uid);
    onHit(enemy, projectile);

    if (!projectile.isSpecial) {
      return false;
    }
  }

  projectile.x = end.x;
  projectile.y = end.y;
  projectile.remainingDistance -= distance;
  const isInsideWall = !isWalkablePosition(map, end.x, end.y, BALANCE.projectileRadius);
  return projectile.remainingDistance > SCENE_EPSILON && !isInsideWall;
}
