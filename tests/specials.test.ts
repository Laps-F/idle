/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/specials.test.ts
 * O que faz: confere o golpe especial de cada encantado na expedição
 * (src/data/specials.ts e src/domain/expeditionSpecials.ts): o que cada um
 * faz, a recarga e os estados que deixa nas visagens.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE } from '../src/data';
import { getSpecial } from '../src/domain/catalog';
import { getRunModifiers, NEUTRAL_RUN_MODIFIERS } from '../src/domain/expeditionModifiers';
import { advanceScene, createExpeditionScene } from '../src/domain/expeditionScene';
import type {
  ExpeditionFighter,
  ExpeditionScene,
  SceneEnemy,
  SpecialEffect,
} from '../src/domain/types';
import { createSeededRandom } from '../src/utils/random';

// =============================================================================
// =============================================================================
// M O N T A G E M

const FIRST_MAP = 'beira-da-mata';
const STOPPED = { moveX: 0, moveY: 0, useSpecial: false };
const SPECIAL = { ...STOPPED, useSpecial: true };

// Cena montada à mão, sem ondas e sem pegadas. A linha 11 da Beira da Mata é livre entre 1 e 30.
function createScene(changes: Partial<ExpeditionScene> = {}): ExpeditionScene {
  return {
    mapId: FIRST_MAP,
    baseLevel: 1,
    footprints: [],
    trailTargets: [],
    footprintTimer: 999,
    footprintIntervalSeconds: 20,
    nextFootprintUid: 1,
    modifiers: { ...NEUTRAL_RUN_MODIFIERS },
    elapsedSeconds: 0,
    playerX: 10.5,
    playerY: 11.5,
    playerHp: 100,
    playerMaxHp: 100,
    hurtSeconds: 0,
    invulnerableSeconds: 0,
    attackProgress: 0,
    specialCooldown: 0,
    specialCooldownTotal: 6,
    facingX: 1,
    facingY: 0,
    enemies: [],
    projectiles: [],
    spawnTimer: 999,
    nextEnemyUid: 10,
    nextProjectileUid: 1,
    ...changes,
  };
}

// Visagem parada num ponto, resistente e sem bater, salvo pedido
function createEnemy(x: number, y: number, changes: Partial<SceneEnemy> = {}): SceneEnemy {
  return {
    uid: 1,
    enemyId: 'visagem-da-neblina',
    level: 1,
    x,
    y,
    hp: 1000,
    maxHp: 1000,
    damage: 0,
    hitCooldown: 0,
    targetX: x,
    targetY: y,
    waitSeconds: 100,
    slowSeconds: 0,
    slowMultiplier: 1,
    confusedSeconds: 0,
    burnSeconds: 0,
    burnDps: 0,
    burnTickSeconds: 0,
    ...changes,
  };
}

// Quem está em campo. Não ataca sozinho (intervalo enorme), para medir só o golpe.
function fighterFor(encantadoId: string, damage = 10): ExpeditionFighter {
  return { encantadoId, damage, attackInterval: 1e9, critChance: 0, maxHp: 100 };
}

// Primeiro efeito do tipo pedido no golpe do encantado
function findEffect<K extends SpecialEffect['kind']>(
  encantadoId: string,
  kind: K,
): Extract<SpecialEffect, { kind: K }> {
  const effect = getSpecial(encantadoId).effects.find((item) => item.kind === kind);

  if (effect === undefined) {
    throw new Error(`O golpe de ${encantadoId} deveria ter o efeito ${kind}.`);
  }
  return effect as Extract<SpecialEffect, { kind: K }>;
}


// =============================================================================
// =============================================================================
// R E C A R G A

describe('recarga do golpe especial', () => {
  it('cada encantado começa com a recarga do próprio golpe', () => {
    for (const encantadoId of ['saci', 'iara', 'curupira']) {
      const setup = {
        mapId: FIRST_MAP,
        fighter: { encantadoId, maxHp: 100, damage: 1 },
        trailTargets: [],
        trailChance: 1,
        modifiers: { ...NEUTRAL_RUN_MODIFIERS },
      };
      const scene = createExpeditionScene(setup, createSeededRandom(1));

      expect(scene.specialCooldown).toBe(0);
      expect(scene.specialCooldownTotal).toBe(getSpecial(encantadoId).cooldownSeconds);
    }
  });

  it('a recarga é a do golpe de quem está em campo, encurtada pela brasa', () => {
    const iara = fighterFor('iara');
    const normal = advanceScene(createScene(), iara, SPECIAL, 0.05, createSeededRandom(1));
    const brasa = createScene({ modifiers: getRunModifiers('brasa-no-bornal') });
    const short = advanceScene(brasa, iara, SPECIAL, 0.05, createSeededRandom(1));
    const cooldown = getSpecial('iara').cooldownSeconds;

    expect(normal.scene.specialCooldownTotal).toBeCloseTo(cooldown, 6);
    expect(short.scene.specialCooldownTotal).toBeCloseTo((cooldown * 2) / 3, 6);
    expect(normal.events.some((event) => event.type === 'special')).toBe(true);
  });

  it('com o golpe recarregando, apertar espaço não faz nada', () => {
    const scene = createScene({ specialCooldown: 3, playerHp: 10 });
    const result = advanceScene(scene, fighterFor('iara'), SPECIAL, 0.05, createSeededRandom(1));

    expect(result.scene.playerHp).toBe(10);
    expect(result.events.some((event) => event.type === 'special')).toBe(false);
  });
});


// =============================================================================
// =============================================================================
// G O L P E S

describe('golpe de cada encantado', () => {
  it('Saci: some no vento (nenhuma encostada tira vida) e empurra as visagens', () => {
    const push = findEffect('saci', 'push');
    const enemy = createEnemy(11, 11.5, { damage: 30 });
    const scene = createScene({ enemies: [enemy] });
    const result = advanceScene(scene, fighterFor('saci'), SPECIAL, 0.05, createSeededRandom(1));
    const pushed = result.scene.enemies[0];

    expect(result.scene.invulnerableSeconds).toBeGreaterThan(0);
    expect(pushed?.x).toBeGreaterThan(11 + push.distance - 0.1);
    expect(pushed?.hp).toBe(1000 - 10 * push.damageMultiplier);

    // Encostada de novo, dentro do Redemoinho: sem dano. Passado o Redemoinho: dano.
    const glued = createScene({
      invulnerableSeconds: 0.5,
      specialCooldown: 5,
      enemies: [createEnemy(10.8, 11.5, { damage: 30 })],
    });
    const safe = advanceScene(glued, fighterFor('saci'), STOPPED, 0.4, createSeededRandom(1));
    const after = advanceScene(safe.scene, fighterFor('saci'), STOPPED, 0.3, createSeededRandom(1));

    expect(safe.scene.playerHp).toBe(100);
    expect(after.scene.playerHp).toBe(70);
  });

  it('Saci: árvore no caminho segura o empurrão', () => {
    // A linha 0 da Beira da Mata é toda de árvores: empurrada para cima, a visagem para antes
    const enemy = createEnemy(10.5, 1.6);
    const scene = createScene({ playerX: 10.5, playerY: 2.5, enemies: [enemy] });
    const result = advanceScene(scene, fighterFor('saci'), SPECIAL, 0.05, createSeededRandom(1));

    expect(result.scene.enemies[0]?.y).toBeGreaterThanOrEqual(1);
  });

  it('Curupira: as visagens perto perdem a pista, não perseguem nem batem', () => {
    const confuse = findEffect('curupira', 'confuse');
    const enemy = createEnemy(12, 11.5, { damage: 30, waitSeconds: 100 });
    const scene = createScene({ enemies: [enemy] });
    const fighter = fighterFor('curupira');
    const result = advanceScene(scene, fighter, SPECIAL, 1, createSeededRandom(1));
    const confused = result.scene.enemies[0];

    // O golpe sai no primeiro pedaço do passo, depois das visagens andarem nele
    expect(confused?.confusedSeconds).toBeGreaterThan(confuse.seconds - 1);
    expect(confused?.confusedSeconds).toBeLessThanOrEqual(confuse.seconds - 1 + 0.05 + 1e-9);
    // Só andou no primeiro pedaço, antes do golpe. Depois ficou parada no passeio.
    const firstStep = BALANCE.enemyChaseSpeed * BALANCE.sceneMaxStepSeconds;
    expect(confused?.x).toBeCloseTo(12 - firstStep, 6);
    expect(result.scene.playerHp).toBe(100);

    // Passado o efeito, volta a perseguir
    const random = createSeededRandom(1);
    const later = advanceScene(result.scene, fighter, STOPPED, confuse.seconds, random);
    expect(later.scene.enemies[0]?.x).toBeLessThan(12 - firstStep);
  });

  it('Iara: o canto recupera parte da vida, sem passar da vida máxima', () => {
    const { fraction } = findEffect('iara', 'heal');
    const hurt = createScene({ playerHp: 40 });
    const healed = advanceScene(hurt, fighterFor('iara'), SPECIAL, 0.05, createSeededRandom(1));
    const almost = createScene({ playerHp: 95 });
    const capped = advanceScene(almost, fighterFor('iara'), SPECIAL, 0.05, createSeededRandom(1));

    expect(healed.scene.playerHp).toBeCloseTo(40 + 100 * fraction, 6);
    expect(healed.events).toContainEqual(
      expect.objectContaining({ type: 'heal', amount: 100 * fraction }),
    );
    expect(capped.scene.playerHp).toBe(100);
  });

  it('Caipora: as visagens perto ficam lentas e uma pegada aparece', () => {
    const slow = findEffect('caipora', 'slow');
    const near = createEnemy(13, 11.5, { uid: 1 });
    const far = createEnemy(25, 11.5, { uid: 2 });
    const targets = [{ encantadoId: 'caipora', remaining: 3 }];
    const scene = createScene({ enemies: [near, far], trailTargets: targets });
    const fighter = fighterFor('caipora');
    const result = advanceScene(scene, fighter, SPECIAL, 0.05, createSeededRandom(1));
    const [slowed, untouched] = result.scene.enemies;

    expect(slowed?.slowSeconds).toBeGreaterThan(0);
    expect(slowed?.slowMultiplier).toBe(slow.speedMultiplier);
    expect(untouched?.slowSeconds).toBe(0);
    expect(result.scene.footprints).toHaveLength(1);
    expect(result.scene.trailTargets[0]?.remaining).toBe(2);

    // Lenta, persegue mais devagar que uma visagem normal
    const normalScene = createScene({ enemies: [createEnemy(13, 11.5)], specialCooldown: 5 });
    const normal = advanceScene(normalScene, fighter, STOPPED, 0.5, createSeededRandom(1));
    const slower = advanceScene(result.scene, fighter, STOPPED, 0.5, createSeededRandom(1));
    const slowStart = slowed?.x ?? 13;
    const normalStep = 13 - (normal.scene.enemies[0]?.x ?? 13);
    const slowStep = slowStart - (slower.scene.enemies[0]?.x ?? slowStart);

    expect(slowStep).toBeCloseTo(normalStep * slow.speedMultiplier, 2);
  });

  it('Caipora: sem ninguém precisando de Rastro, o assobio não faz pegada', () => {
    const scene = createScene();
    const result = advanceScene(scene, fighterFor('caipora'), SPECIAL, 0.05, createSeededRandom(1));

    expect(result.scene.footprints).toEqual([]);
  });

  it('Boitatá: a labareda atravessa e deixa as visagens queimando', () => {
    const fire = findEffect('boitata', 'projectile');
    const enemies = [createEnemy(12.5, 11.5, { uid: 1 }), createEnemy(13.5, 11.5, { uid: 2 })];
    const scene = createScene({ enemies });
    const fighter = fighterFor('boitata');
    const hit = advanceScene(scene, fighter, SPECIAL, 0.4, createSeededRandom(1));
    const hitDamage = 10 * fire.damageMultiplier;

    const hpAfterHit = 1000 - hitDamage;
    expect(hit.scene.enemies.map((enemy) => enemy.hp)).toEqual([hpAfterHit, hpAfterHit]);
    expect(hit.scene.enemies.every((enemy) => enemy.burnSeconds > 0)).toBe(true);

    // A queimadura inteira tira burnDps por segundo, durante burnSeconds
    const burnStep = fire.burnSeconds + 1;
    const burned = advanceScene(hit.scene, fighter, STOPPED, burnStep, createSeededRandom(1));
    const burnTotal = 10 * fire.burnDpsMultiplier * fire.burnSeconds;

    for (const enemy of burned.scene.enemies) {
      expect(enemy.hp).toBeCloseTo(hpAfterHit - burnTotal, 6);
      expect(enemy.burnSeconds).toBe(0);
    }
  });

  it('Boitatá: a queimadura derruba e a derrota conta uma vez só', () => {
    const burning = { hp: 1, burnSeconds: 2, burnDps: 10, burnTickSeconds: 0.1 };
    const enemy = createEnemy(20, 11.5, burning);
    const scene = createScene({ enemies: [enemy], specialCooldown: 5 });
    const result = advanceScene(scene, fighterFor('boitata'), STOPPED, 1, createSeededRandom(1));

    expect(result.scene.enemies).toEqual([]);
    expect(result.kills).toHaveLength(1);
  });

  it('encantado sem golpe nos dados solta o projétil padrão', () => {
    const enemy = createEnemy(12.5, 11.5);
    const scene = createScene({ enemies: [enemy] });
    const result = advanceScene(scene, fighterFor('ninguem'), SPECIAL, 0.4, createSeededRandom(1));

    expect(result.scene.enemies[0]?.hp).toBe(1000 - 10 * BALANCE.specialDamageMultiplier);
    expect(result.scene.specialCooldownTotal).toBe(BALANCE.specialCooldownSeconds);
  });
});
