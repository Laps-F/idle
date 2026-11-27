/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionSpecials.ts
 * O que faz: o golpe especial de cada encantado na expedição e os estados que
 * ele deixa nas visagens (lenta, sem a pista, queimando). Os golpes são dados
 * (src/data/specials.ts): cada um é uma lista de efeitos, e este arquivo sabe
 * aplicar cada tipo de efeito.
 *
 * Quem usa: src/domain/expeditionScene.ts chama castSpecial quando a pessoa
 * aperta espaço com o golpe pronto, updateEnemyStatus a cada passo de cada
 * visagem, e lê isConfused e getSpeedMultiplier para mover as visagens.
 *
 * Regras:
 *   - O dano dos efeitos conta sobre o dano do golpe comum de quem está em
 *     campo, vezes o specialDamage da partida (preparo "Brasa no bornal").
 *   - A recarga é a do golpe, vezes o specialCooldown da partida.
 *   - Um estado novo do mesmo tipo troca o antigo pelo mais longo.
 *   - A queimadura bate a cada BURN_TICK_SECONDS, para não encher a tela de números.
 *
 * Pureza: as funções alteram só a cena de trabalho (o "draft" de advanceScene)
 * e as listas do contexto do passo, como o resto do passo da cena.
 *
 * Mapa:
 *   1. Tipos e constantes
 *   2. Golpe especial
 *   3. Efeitos
 *   4. Estados das visagens
 */

import { BALANCE } from '../data/balance';
import { getSpecial, hasSpecial } from './catalog';
import { spawnFootprintNow } from './expeditionFootprints';
import type { FootprintContext } from './expeditionFootprints';
import { launchProjectile } from './expeditionProjectiles';
import { getDistance, getPlayerPoint, isWalkablePosition, SCENE_EPSILON } from './sceneGeometry';
import type { ExpeditionFighter, SceneEnemy, SpecialDef, SpecialEffect } from './types';

// =============================================================================
// =============================================================================
// T I P O S   E   C O N S T A N T E S

// O que os golpes precisam do passo. O StepContext de expeditionScene.ts serve.
export interface SpecialContext extends FootprintContext {
  // Tira vida de uma visagem e cuida da derrota (é o damageEnemy da cena)
  damageEnemy: (enemy: SceneEnemy, damage: number) => void;
}

// De quanto em quanto tempo a queimadura bate
const BURN_TICK_SECONDS = 0.5;

// Em quantos pedaços o empurrão é conferido contra árvore e água
const PUSH_STEPS = 5;


// =============================================================================
// =============================================================================
// G O L P E   E S P E C I A L

// Recarga inteira do golpe de um encantado nesta partida. Sem golpe nos dados, a padrão.
export function getSpecialCooldown(encantadoId: string, cooldownMultiplier: number): number {
  const base = hasSpecial(encantadoId)
    ? getSpecial(encantadoId).cooldownSeconds
    : BALANCE.specialCooldownSeconds;
  return base * cooldownMultiplier;
}

/**
 * Solta o golpe especial de quem está em campo: aplica cada efeito, na ordem, e
 * começa a recarga.
 *
 * @param context Contexto do passo. Altera o draft (vida, visagens, projéteis,
 *                pegadas, recarga) e as listas de eventos e Rastros.
 * @param fighter Quem está em campo. O golpe é o dele (src/data/specials.ts).
 *
 * Caso de borda: encantado sem golpe nos dados solta um projétil que atravessa, com
 * specialDamageMultiplier de BALANCE (o golpe de antes do Caminho 2).
 */
export function castSpecial(context: SpecialContext, fighter: ExpeditionFighter): void {
  const { draft } = context;
  const special = getSpecialOrDefault(fighter.encantadoId);
  const radius = Math.max(0, ...special.effects.map(getEffectRadius));

  draft.specialCooldown = getSpecialCooldown(fighter.encantadoId, draft.modifiers.specialCooldown);
  context.events.push({
    type: 'special',
    x: draft.playerX,
    y: draft.playerY,
    encantadoId: fighter.encantadoId,
    radius,
  });

  for (const effect of special.effects) {
    applyEffect(context, effect, fighter.damage * draft.modifiers.specialDamage);
  }
}

// O golpe do encantado, ou o projétil padrão para quem não tem golpe nos dados
function getSpecialOrDefault(encantadoId: string): SpecialDef {
  if (hasSpecial(encantadoId)) {
    return getSpecial(encantadoId);
  }

  return {
    encantadoId,
    name: 'Golpe especial',
    description: '',
    cooldownSeconds: BALANCE.specialCooldownSeconds,
    effects: [
      {
        kind: 'projectile',
        damageMultiplier: BALANCE.specialDamageMultiplier,
        burnDpsMultiplier: 0,
        burnSeconds: 0,
      },
    ],
  };
}

// Raio do anel que a tela desenha ao soltar o golpe (zero para os que não têm área)
function getEffectRadius(effect: SpecialEffect): number {
  return 'radius' in effect ? effect.radius : 0;
}


// =============================================================================
// =============================================================================
// E F E I T O S

// Aplica um efeito. "damage" é o dano do golpe comum já com o preparo.
function applyEffect(context: SpecialContext, effect: SpecialEffect, damage: number): void {
  const { draft } = context;

  switch (effect.kind) {
    case 'projectile':
      launchProjectile(draft, {
        isSpecial: true,
        direction: { x: draft.facingX, y: draft.facingY },
        speed: BALANCE.specialProjectileSpeed,
        maxDistance: BALANCE.specialProjectileMaxDistance,
        damage: damage * effect.damageMultiplier,
        isCrit: false,
        burnDps: damage * effect.burnDpsMultiplier,
        burnSeconds: effect.burnSeconds,
      });
      return;
    case 'push':
      pushEnemies(context, effect.radius, effect.distance, damage * effect.damageMultiplier);
      return;
    case 'invulnerable':
      draft.invulnerableSeconds = Math.max(draft.invulnerableSeconds, effect.seconds);
      return;
    case 'confuse':
      for (const enemy of getEnemiesNear(context, effect.radius)) {
        enemy.confusedSeconds = Math.max(enemy.confusedSeconds, effect.seconds);
      }
      return;
    case 'slow':
      for (const enemy of getEnemiesNear(context, effect.radius)) {
        enemy.slowSeconds = Math.max(enemy.slowSeconds, effect.seconds);
        enemy.slowMultiplier = Math.min(enemy.slowMultiplier, effect.speedMultiplier);
      }
      return;
    case 'heal':
      heal(context, effect.fraction);
      return;
    case 'footprint':
      spawnFootprintNow(context);
      return;
  }
}

// Visagens a até "radius" ladrilhos da personagem (cópia da lista)
function getEnemiesNear(context: SpecialContext, radius: number): SceneEnemy[] {
  const player = getPlayerPoint(context.draft);
  return context.draft.enemies.filter((enemy) => getDistance(enemy, player) <= radius);
}

// Empurra para longe da personagem e tira vida. Árvore ou água no caminho param o empurrão.
function pushEnemies(context: SpecialContext, radius: number, distance: number, damage: number) {
  const player = getPlayerPoint(context.draft);

  for (const enemy of getEnemiesNear(context, radius)) {
    const gap = getDistance(enemy, player);
    const directionX = gap > SCENE_EPSILON ? (enemy.x - player.x) / gap : 1;
    const directionY = gap > SCENE_EPSILON ? (enemy.y - player.y) / gap : 0;

    for (let step = 0; step < PUSH_STEPS; step += 1) {
      const nextX = enemy.x + (directionX * distance) / PUSH_STEPS;
      const nextY = enemy.y + (directionY * distance) / PUSH_STEPS;

      if (!isWalkablePosition(context.map, nextX, nextY)) {
        break;
      }
      enemy.x = nextX;
      enemy.y = nextY;
    }

    if (damage > 0) {
      context.damageEnemy(enemy, damage);
    }
  }
}

// Recupera parte da vida máxima, sem passar dela
function heal(context: SpecialContext, fraction: number): void {
  const { draft } = context;
  const amount = Math.min(draft.playerMaxHp - draft.playerHp, draft.playerMaxHp * fraction);

  if (amount <= 0) {
    return;
  }

  draft.playerHp += amount;
  context.events.push({ type: 'heal', x: draft.playerX, y: draft.playerY, amount });
}


// =============================================================================
// =============================================================================
// E S T A D O S   D A S   V I S A G E N S

// Deixa a visagem queimando. A queimadura mais longa (ou mais forte) fica.
export function applyBurn(enemy: SceneEnemy, dps: number, seconds: number): void {
  if (!(dps > 0) || !(seconds > 0)) {
    return;
  }

  if (enemy.burnSeconds <= 0) {
    enemy.burnTickSeconds = BURN_TICK_SECONDS;
  }
  enemy.burnSeconds = Math.max(enemy.burnSeconds, seconds);
  enemy.burnDps = Math.max(enemy.burnDps, dps);
}

/**
 * Faz os estados da visagem andarem: lentidão, falta de pista e queimadura.
 *
 * @param context Contexto do passo. A queimadura usa context.damageEnemy, que pode
 *                tirar a visagem do mapa.
 * @param enemy Visagem do draft.
 * @param seconds Duração do passo.
 */
export function updateEnemyStatus(
  context: SpecialContext,
  enemy: SceneEnemy,
  seconds: number,
): void {
  enemy.confusedSeconds = Math.max(0, enemy.confusedSeconds - seconds);
  enemy.slowSeconds = Math.max(0, enemy.slowSeconds - seconds);

  if (enemy.slowSeconds <= 0) {
    enemy.slowMultiplier = 1;
  }

  if (enemy.burnSeconds <= 0) {
    return;
  }

  const burning = Math.min(seconds, enemy.burnSeconds);
  enemy.burnSeconds -= burning;
  enemy.burnTickSeconds -= burning;

  if (enemy.burnTickSeconds <= SCENE_EPSILON) {
    enemy.burnTickSeconds += BURN_TICK_SECONDS;
    context.damageEnemy(enemy, enemy.burnDps * BURN_TICK_SECONDS);
  }

  if (enemy.burnSeconds <= 0) {
    enemy.burnDps = 0;
  }
}

// Sem a pista, a visagem não persegue nem bate: só passeia
export function isConfused(enemy: SceneEnemy): boolean {
  return enemy.confusedSeconds > 0;
}

// Velocidade da visagem agora (lenta pelo Assobio, ou normal)
export function getSpeedMultiplier(enemy: SceneEnemy): number {
  return enemy.slowSeconds > 0 ? enemy.slowMultiplier : 1;
}
