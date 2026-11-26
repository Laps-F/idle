/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/expedition.test.ts
 * O que faz: testa as regras da expedição sem navegador. Na cena: montagem,
 * movimento com colisão, passagem de volta, perseguição, encostada, queda,
 * golpe automático, golpe especial, ondas e fim do tempo. Fora da cena: quem
 * sai, partir, bolsa e a volta com o bônus. Os golpes são projéteis. O sorteio usa semente e as
 * entradas são congeladas, para denunciar qualquer alteração indevida.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE } from '../src/data';
import { chooseStarter } from '../src/domain/actions';
import { getEnemy, getExpeditionLoot, getExpeditionMap } from '../src/domain/catalog';
import { rewardExpeditionBag } from '../src/domain/expeditionLoot';
import {
  canAffordPreparation,
  getRunModifiers,
  NEUTRAL_RUN_MODIFIERS,
} from '../src/domain/expeditionModifiers';
import {
  addKillsToLoot,
  addTrailsToLoot,
  countLoot,
  countTrails,
  finishExpedition,
  getExpeditionFighter,
  getTrailTargets,
  startExpedition,
} from '../src/domain/expedition';
import { advanceScene, createExpeditionScene } from '../src/domain/expeditionScene';
import {
  getEnemyContactDamage,
  getFighterBaseLevel,
  getMapStartLevel,
  getWaveLevel,
} from '../src/domain/expeditionScaling';
import {
  getEnemyMaxHp,
  getExpeditionMaxHp,
  getGoldReward,
  getXpReward,
} from '../src/domain/formulas';
import { getModifiers } from '../src/domain/modifiers';
import { isWalkablePosition } from '../src/domain/sceneGeometry';
import { createInitialState } from '../src/domain/state';
import type {
  ExpeditionFighter,
  ExpeditionScene,
  GameState,
  MapKill,
  SceneEnemy,
  SceneSetup,
  TrailTarget,
} from '../src/domain/types';
import { createSeededRandom } from '../src/utils/random';

const FIRST_MAP = 'beira-da-mata';
const STOPPED = { moveX: 0, moveY: 0, useSpecial: false };
const POSITION_DIGITS = 6;

// Congela o objeto inteiro. Alterar um objeto congelado lança erro nos testes.
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

// Cena montada à mão, sem visagens sorteadas e sem ondas, para medir posição e golpes.
// A linha 11 da Beira da Mata é toda livre entre as colunas 1 e 30.
function createScene(changes: Partial<ExpeditionScene> = {}): ExpeditionScene {
  return deepFreeze({
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
    attackProgress: 0,
    specialCooldown: 0,
    facingX: 1,
    facingY: 0,
    enemies: [],
    projectiles: [],
    spawnTimer: 999,
    nextEnemyUid: 10,
    nextProjectileUid: 1,
    ...changes,
  });
}

// O que a cena precisa para começar, no primeiro mapa e sem pegadas
function setupFor(fighter: SceneSetup['fighter'], targets: TrailTarget[] = []): SceneSetup {
  return {
    mapId: FIRST_MAP,
    fighter,
    trailTargets: targets,
    trailChance: 1,
    modifiers: { ...NEUTRAL_RUN_MODIFIERS },
  };
}

// Visagem parada num ponto
function createEnemy(x: number, y: number, changes: Partial<SceneEnemy> = {}): SceneEnemy {
  return {
    uid: 1,
    enemyId: 'visagem-da-neblina',
    level: 1,
    x,
    y,
    hp: 10,
    maxHp: 10,
    damage: 7,
    hitCooldown: 0,
    targetX: x,
    targetY: y,
    waitSeconds: 100,
    ...changes,
  };
}

// Quem bate, com números redondos
const STRONG_FIGHTER: ExpeditionFighter = {
  encantadoId: 'saci',
  damage: 1000,
  attackInterval: 1,
  critChance: 0,
  maxHp: 100,
};

// Jogo com o Saci na comitiva
function createGame(): GameState {
  const started = chooseStarter(createInitialState(0, createSeededRandom(1)), 'saci');

  if (started === null) {
    throw new Error('O Saci deveria ser um encantado inicial.');
  }

  return deepFreeze(started);
}

// Jogo com o Saci em expedição e uma bolsa pronta
function createGameOnExpedition(): GameState {
  const game = createGame();
  return deepFreeze({
    ...game,
    expedition: {
      mapId: FIRST_MAP,
      encantadoId: 'saci',
      loot: [
        { enemyId: 'visagem-da-neblina', level: 1, count: 4 },
        { enemyId: 'vulto-da-capoeira', level: 2, count: 2 },
      ],
      trails: {},
      preparationId: null,
    },
  });
}

describe('montagem da cena', () => {
  it('põe a personagem no início, com vida cheia, e as visagens longe dela', () => {
    const map = getExpeditionMap(FIRST_MAP);
    const fighter = { maxHp: 130, damage: 3 };
    const scene = createExpeditionScene(setupFor(fighter), createSeededRandom(3));

    expect(scene.playerX).toBe(map.start.x + 0.5);
    expect(scene.playerHp).toBe(130);
    expect(scene.playerMaxHp).toBe(130);
    expect(scene.enemies).toHaveLength(BALANCE.waveStartEnemies);

    for (const enemy of scene.enemies) {
      const distance = Math.hypot(enemy.x - scene.playerX, enemy.y - scene.playerY);
      expect(isWalkablePosition(map, enemy.x, enemy.y)).toBe(true);
      expect(distance).toBeGreaterThanOrEqual(BALANCE.enemyMinSpawnDistance);
      expect(enemy.level).toBe(getMapStartLevel(1, map));
    }
  });

  it('o nível de partida acompanha o dano de quem sai', () => {
    const strongFighter = { maxHp: 100, damage: 50 };
    const strong = createExpeditionScene(setupFor(strongFighter), createSeededRandom(3));
    const level = getFighterBaseLevel(50);
    const commonHp = getEnemyMaxHp(level, getEnemy('visagem-da-neblina'), false);

    expect(strong.baseLevel).toBe(level);
    expect(strong.enemies.every((enemy) => enemy.level === level)).toBe(true);
    // A visagem comum de multiplicador 1 aguenta entre 3 ÷ 1,18 e 3 golpes
    expect(commonHp / 50).toBeLessThanOrEqual(BALANCE.expeditionHitsPerEnemy + 1e-9);
    expect(commonHp / 50).toBeGreaterThan(BALANCE.expeditionHitsPerEnemy / BALANCE.enemyHpGrowth);
    expect(getEnemyMaxHp(level + 1, getEnemy('visagem-da-neblina'), false) / 50).toBeGreaterThan(
      BALANCE.expeditionHitsPerEnemy,
    );
  });

  it('dano fraco, zero ou que não é número parte do nível 1, e cada mapa soma o seu bônus', () => {
    const brejo = getExpeditionMap('brejo-escuro');

    expect(getFighterBaseLevel(0)).toBe(1);
    expect(getFighterBaseLevel(Number.NaN)).toBe(1);
    expect(getFighterBaseLevel(1)).toBe(1);
    expect(createExpeditionScene(setupFor(null), createSeededRandom(1)).baseLevel).toBe(1);
    expect(getMapStartLevel(10, brejo)).toBe(10 + brejo.levelBonus);
  });

  it('não aceita posição que não é número', () => {
    expect(isWalkablePosition(getExpeditionMap(FIRST_MAP), Number.NaN, 5)).toBe(false);
  });
});

describe('movimento e passagem de volta', () => {
  it('anda na velocidade combinada e não altera a cena recebida', () => {
    const scene = createScene();
    const input = deepFreeze({ moveX: 1, moveY: 0, useSpecial: false });
    const result = advanceScene(scene, null, input, 1, createSeededRandom(1));

    expect(result.scene.playerX).toBeCloseTo(10.5 + BALANCE.playerSpeed, POSITION_DIGITS);
    expect(result.scene.elapsedSeconds).toBeCloseTo(1, POSITION_DIGITS);
    expect(scene.playerX).toBe(10.5);
  });

  it('anda na diagonal com a mesma velocidade', () => {
    const scene = createScene({ playerX: 3.5, playerY: 11.5 });
    const input = { moveX: 1, moveY: 1, useSpecial: false };
    const result = advanceScene(scene, null, input, 0.25, Math.random);
    const walked = Math.hypot(result.scene.playerX - 3.5, result.scene.playerY - 11.5);

    expect(walked).toBeCloseTo(BALANCE.playerSpeed * 0.25, POSITION_DIGITS);
  });

  it('para ao encostar numa árvore', () => {
    const scene = createScene({ playerX: 1.5, playerY: 1.5 });
    const input = { moveX: 0, moveY: -1, useSpecial: false };
    const result = advanceScene(scene, null, input, 1, Math.random);

    expect(result.scene.playerY).toBeGreaterThanOrEqual(1 + BALANCE.bodyRadius);
    expect(result.scene.playerY).toBeLessThan(1.5);
  });

  it('termina como "voltou" ao pisar na passagem de volta', () => {
    // A passagem da Beira da Mata fica na coluna 1, linha 10
    const scene = createScene({ playerX: 2.5, playerY: 10.5 });
    const input = { moveX: -1, moveY: 0, useSpecial: false };
    const result = advanceScene(scene, null, input, 1, createSeededRandom(2));

    expect(result.outcome).toBe('voltou');
    expect(result.scene.elapsedSeconds).toBeLessThan(1);
  });

  it('não faz nada com tempo zero ou inválido', () => {
    const scene = createScene();
    expect(advanceScene(scene, null, STOPPED, 0, Math.random).scene).toBe(scene);
    expect(advanceScene(scene, null, STOPPED, Number.NaN, Math.random).scene).toBe(scene);
  });
});

describe('visagens', () => {
  it('perseguem quem chega perto', () => {
    const scene = createScene({ enemies: [createEnemy(13.5, 11.5)] });
    const result = advanceScene(scene, null, STOPPED, 0.5, createSeededRandom(1));
    const expectedX = 13.5 - BALANCE.enemyChaseSpeed * 0.5;

    expect(result.scene.enemies[0]?.x).toBeCloseTo(expectedX, POSITION_DIGITS);
  });

  it('não perseguem quem está longe', () => {
    const scene = createScene({ enemies: [createEnemy(20.5, 11.5)] });
    const result = advanceScene(scene, null, STOPPED, 0.5, createSeededRandom(1));
    expect(result.scene.enemies[0]?.x).toBe(20.5);
  });

  it('batem ao encostar, no máximo uma vez por recarga', () => {
    const scene = createScene({ enemies: [createEnemy(11, 11.5)] });
    const first = advanceScene(scene, null, STOPPED, 0.05, createSeededRandom(1));
    const soon = advanceScene(first.scene, null, STOPPED, 0.5, createSeededRandom(1));
    const later = advanceScene(soon.scene, null, STOPPED, 0.6, createSeededRandom(1));

    expect(first.scene.playerHp).toBe(93);
    expect(first.scene.hurtSeconds).toBeGreaterThan(0);
    expect(first.events).toContainEqual({ type: 'hurt', x: 10.5, y: 11.5, damage: 7 });
    expect(soon.scene.playerHp).toBe(93);
    expect(later.scene.playerHp).toBe(86);
  });

  it('a expedição termina como "caiu" quando a vida zera', () => {
    const scene = createScene({ playerHp: 5, enemies: [createEnemy(11, 11.5)] });
    const result = advanceScene(scene, STRONG_FIGHTER, STOPPED, 1, createSeededRandom(1));

    expect(result.outcome).toBe('caiu');
    expect(result.scene.playerHp).toBe(0);
  });

  it('as ondas trazem visagens cada vez mais fortes', () => {
    const map = getExpeditionMap(FIRST_MAP);
    const scene = createScene({ spawnTimer: 0.01, elapsedSeconds: 125 });
    const result = advanceScene(scene, null, STOPPED, 0.05, createSeededRandom(4));

    expect(result.scene.enemies).toHaveLength(1);
    expect(result.scene.enemies[0]?.level).toBe(getMapStartLevel(1, map) + 2);
    expect(getWaveLevel(5, map, 59)).toBe(getMapStartLevel(5, map));
    expect(getWaveLevel(5, map, 60)).toBe(getMapStartLevel(5, map) + 1);
  });

  it('a expedição termina como "concluida" no fim do tempo', () => {
    const scene = createScene({ elapsedSeconds: BALANCE.expeditionDurationSeconds - 0.01 });
    const result = advanceScene(scene, null, STOPPED, 1, createSeededRandom(1));

    expect(result.outcome).toBe('concluida');
  });
});

describe('golpes e projéteis', () => {
  // Visagem resistente, que não bate, para medir quantos projéteis acertam
  function createTarget(uid: number, x: number, y: number): SceneEnemy {
    return createEnemy(x, y, { uid, damage: 0, hp: 100, maxHp: 100 });
  }

  const weakFighter = { ...STRONG_FIGHTER, damage: 2 };
  const specialDamage = 2 * BALANCE.specialDamageMultiplier;

  it('o golpe comum vira um projétil que voa até a visagem e a derruba', () => {
    // A visagem fica a 3,5 ladrilhos: o projétil leva alguns passos para chegar
    const enemy = createEnemy(14, 11.5, { level: 3, damage: 0 });
    const scene = createScene({ attackProgress: 1, enemies: [enemy] });
    const fired = advanceScene(scene, STRONG_FIGHTER, STOPPED, 0.05, createSeededRandom(1));
    const landed = advanceScene(fired.scene, STRONG_FIGHTER, STOPPED, 0.5, createSeededRandom(1));

    expect(fired.scene.projectiles).toHaveLength(1);
    expect(fired.scene.projectiles[0]?.directionX).toBe(1);
    expect(fired.kills).toEqual([]);
    expect(landed.scene.enemies).toEqual([]);
    expect(landed.scene.projectiles).toEqual([]);
    expect(landed.kills).toEqual([
      { enemyId: 'visagem-da-neblina', stage: 3, zoneId: 'mata-atlantica' },
    ]);
    expect(landed.events.map((event) => event.type)).toEqual(['hit', 'defeat']);
  });

  it('não atira em visagem fora do alcance e deixa a barra cheia esperando', () => {
    const scene = createScene({ attackProgress: 1, enemies: [createTarget(1, 15.5, 11.5)] });
    const result = advanceScene(scene, STRONG_FIGHTER, STOPPED, 0.05, createSeededRandom(1));

    expect(result.scene.projectiles).toEqual([]);
    expect(result.scene.attackProgress).toBe(1);
  });

  it('o projétil comum para na primeira visagem que acerta', () => {
    const enemies = [createTarget(1, 12.5, 11.5), createTarget(2, 13.5, 11.5)];
    const scene = createScene({ attackProgress: 1, enemies });
    const result = advanceScene(scene, weakFighter, STOPPED, 0.5, createSeededRandom(1));

    expect(result.scene.enemies.map((enemy) => enemy.hp)).toEqual([98, 100]);
  });

  it('o especial sai para o lado em que a personagem olha e atravessa as visagens', () => {
    const enemies = [createTarget(1, 12.5, 11.5), createTarget(2, 13.5, 11.5)];
    const scene = createScene({ enemies });
    const special = { ...STOPPED, useSpecial: true };
    const first = advanceScene(scene, weakFighter, special, 0.5, createSeededRandom(1));
    const again = advanceScene(first.scene, weakFighter, special, 0.05, createSeededRandom(1));

    expect(first.scene.enemies.map((enemy) => enemy.hp)).toEqual([
      100 - specialDamage,
      100 - specialDamage,
    ]);
    expect(first.scene.specialCooldown).toBeGreaterThan(0);
    expect(again.scene.projectiles.filter((projectile) => projectile.isSpecial)).toHaveLength(1);
  });

  it('o especial segue a última direção em que a personagem andou', () => {
    const scene = createScene();
    const up = { moveX: 0, moveY: -1, useSpecial: false };
    const walked = advanceScene(scene, weakFighter, up, 0.05, createSeededRandom(1));
    const special = { ...STOPPED, useSpecial: true };
    const fired = advanceScene(walked.scene, weakFighter, special, 0.05, createSeededRandom(1));

    expect(walked.scene.facingY).toBe(-1);
    expect(fired.scene.projectiles[0]?.directionY).toBe(-1);
    expect(fired.scene.projectiles[0]?.directionX).toBeCloseTo(0, 6);
  });

  it('o projétil some ao bater numa árvore ou ao passar da distância máxima', () => {
    const special = { ...STOPPED, useSpecial: true };
    // A linha 0 da Beira da Mata é toda de árvores
    const wallScene = createScene({ playerX: 1.5, playerY: 1.5, facingX: 0, facingY: -1 });
    const wall = advanceScene(wallScene, weakFighter, special, 0.2, createSeededRandom(1));
    const open = advanceScene(createScene(), weakFighter, special, 1, createSeededRandom(1));

    expect(wall.scene.projectiles).toEqual([]);
    expect(open.scene.projectiles).toEqual([]);
  });
});

describe('fórmulas da expedição', () => {
  it('a vida cresce com o nível do encantado', () => {
    expect(getExpeditionMaxHp(1)).toBe(BALANCE.playerBaseHp);
    expect(getExpeditionMaxHp(11)).toBe(BALANCE.playerBaseHp * 2);
  });

  it('a encostada tira uma fração da vida, que cresce com os níveis acima da partida', () => {
    const neblina = getEnemy('visagem-da-neblina');
    const atStart = Math.ceil(1000 * BALANCE.enemyContactHpFraction);
    const fourAboveFraction = BALANCE.enemyContactHpFraction * BALANCE.enemyContactGrowth ** 4;

    expect(getEnemyContactDamage(1000, 30, 30, neblina)).toBe(atStart);
    expect(getEnemyContactDamage(1000, 34, 30, neblina)).toBe(Math.ceil(1000 * fourAboveFraction));
    // A mesma fração para quem tem mais vida: a vida maior não deixa a expedição mais fácil
    expect(getEnemyContactDamage(2000, 34, 30, neblina)).toBe(Math.ceil(2000 * fourAboveFraction));
    expect(getEnemyContactDamage(1000, 10, 30, neblina)).toBe(atStart);
    expect(getEnemyContactDamage(1, 1, 1, neblina)).toBe(1);
  });
});

describe('partir, bolsa e volta', () => {
  it('quem sai é o primeiro da comitiva, com os números da clareira', () => {
    const game = createGame();
    const fighter = getExpeditionFighter(game, 0);
    const modifiers = getModifiers(game, 'dia');

    expect(getExpeditionFighter(createInitialState(0, Math.random), 0)).toBeNull();
    expect(fighter?.encantadoId).toBe('saci');
    expect(fighter?.damage).toBeCloseTo(3 * (1 + BALANCE.damagePerLevel) * modifiers.damage, 6);
    expect(fighter?.maxHp).toBe(getExpeditionMaxHp(1));
  });

  it('parte só com comitiva e uma expedição por vez', () => {
    const game = createGame();
    const started = startExpedition(game, FIRST_MAP);

    expect(startExpedition(createInitialState(0, Math.random), FIRST_MAP)).toBeNull();
    expect(startExpedition(game, 'nada')).toBeNull();
    expect(started?.expedition).toEqual({
      mapId: FIRST_MAP,
      encantadoId: 'saci',
      loot: [],
      trails: {},
      preparationId: null,
    });
    expect(started === null ? null : startExpedition(started, FIRST_MAP)).toBeNull();
  });

  it('junta na bolsa as visagens do mesmo tipo e nível', () => {
    const game = createGameOnExpedition();
    const kill = { enemyId: 'visagem-da-neblina', stage: 1, zoneId: 'mata-atlantica' };
    const other = { enemyId: 'visagem-da-neblina', stage: 2, zoneId: 'mata-atlantica' };
    const next = addKillsToLoot(game, [kill, kill, other]);

    expect(next.expedition?.loot).toEqual([
      { enemyId: 'visagem-da-neblina', level: 1, count: 6 },
      { enemyId: 'vulto-da-capoeira', level: 2, count: 2 },
      { enemyId: 'visagem-da-neblina', level: 2, count: 1 },
    ]);
    expect(countLoot(next.expedition?.loot ?? [])).toBe(9);
    expect(addKillsToLoot(game, [])).toBe(game);
    expect(addKillsToLoot(createGame(), [kill])).toEqual(createGame());
  });

  it('volta com a bolsa inteira, sem bônus', () => {
    const game = createGameOnExpedition();
    const result = finishExpedition(game, 'caiu', 42, {
      startTimestamp: 0,
      random: createSeededRandom(5),
    });

    expect(result.state.expedition).toBeNull();
    expect(result.report?.outcome).toBe('caiu');
    expect(result.report?.kills).toBe(6);
    expect(result.report?.bonusKills).toBe(0);
    expect(result.report?.seconds).toBe(42);
    expect(result.state.gold).toBe(game.gold + (result.report?.summary.gold ?? 0));
    expect(result.state.stats.totalKills).toBe(game.stats.totalKills + 6);
  });

  it('quem aguenta até o fim ganha visagens de bônus', () => {
    const game = createGameOnExpedition();
    const options = { startTimestamp: 0, random: createSeededRandom(5) };
    const plain = finishExpedition(game, 'voltou', 300, options);
    const complete = finishExpedition(game, 'concluida', 300, {
      ...options,
      random: createSeededRandom(5),
    });

    expect(complete.report?.bonusKills).toBe(Math.floor(6 * BALANCE.expeditionCompletionBonus));
    expect(complete.state.gold).toBeGreaterThan(plain.state.gold);
  });

  it('sem expedição em andamento, nada muda', () => {
    const game = createGame();
    const result = finishExpedition(game, 'voltou', 1, { startTimestamp: 0, random: Math.random });

    expect(result.state).toBe(game);
    expect(result.report).toBeNull();
  });
});

describe('saque próprio da expedição', () => {
  const kill = { enemyId: 'vulto-da-capoeira', stage: 12, zoneId: 'mata-atlantica' };
  // Sorteio que nunca acerta: nada de Oferenda, Rastro nem amuleto, só Patacas e XP
  const neverLucky = (): number => 0.999999;
  const alwaysLucky = (): number => 0;
  const onFirstMap = (kills: MapKill[]) => ({ mapId: FIRST_MAP, kills, trails: {} });

  it('Patacas e XP são a fórmula da clareira no nível da visagem, vezes o mapa', () => {
    const game = createGame();
    const modifiers = getModifiers(game, 'dia');
    const enemy = getEnemy(kill.enemyId);

    for (const mapId of ['beira-da-mata', 'brejo-escuro']) {
      const loot = getExpeditionLoot(mapId);
      const options = { startTimestamp: 0, random: neverLucky };
      const result = rewardExpeditionBag(game, { mapId, kills: [kill, kill], trails: {} }, options);
      const gold = getGoldReward(12, enemy, false, modifiers.gold) * loot.goldMultiplier;
      const xp = getXpReward(12, enemy, false) * loot.xpMultiplier;

      expect(result.summary.gold).toBeCloseTo(2 * gold, 6);
      expect(result.summary.xp).toBeCloseTo(2 * xp, 6);
      expect(result.summary.kills).toBe(2);
      expect(result.state.stats.totalKills).toBe(game.stats.totalKills + 2);
      expect(result.summary.items).toEqual({});
      expect(result.summary.amuletsFound).toBe(0);
    }
  });

  it('as Oferendas vêm da tabela do mapa, não da tabela da visagem', () => {
    const game = createGame();
    const options = { startTimestamp: 0, random: alwaysLucky };
    const bag = { mapId: 'brejo-escuro', kills: [kill], trails: {} };
    const result = rewardExpeditionBag(game, bag, options);
    const expected = Object.fromEntries(
      getExpeditionLoot('brejo-escuro').drops.map((drop) => [drop.itemId, drop.min]),
    );

    // O Vulto da Capoeira só deixa cipó na clareira. No Brejo pode deixar até brasa viva.
    expect(result.summary.items).toEqual(expected);
    expect(result.summary.items['brasa-viva']).toBe(1);
    expect(result.summary.amuletsFound).toBe(1);
  });

  it('o amuleto usa a chance do mapa e a força do nível da visagem', () => {
    const game = createGame();
    // Acima da chance de visagem comum da clareira, abaixo da chance do mapa: só o mapa dá amuleto
    const mapChance = getExpeditionLoot(FIRST_MAP).amuletChance;
    const between = (BALANCE.amuletCommonDropChance + mapChance) / 2;
    const random = (): number => between;
    const result = rewardExpeditionBag(game, onFirstMap([kill]), { startTimestamp: 0, random });
    const amulet = Object.values(result.state.amulets)[0];

    expect(result.summary.amuletsFound).toBe(1);
    expect(amulet?.foundAtStage).toBe(12);
  });

  it('bolsa vazia não muda nada e o estado recebido não é alterado', () => {
    const game = createGame();
    const options = { startTimestamp: 0, random: alwaysLucky };

    expect(rewardExpeditionBag(game, onFirstMap([]), options).state).toBe(game);
    expect(() => rewardExpeditionBag(game, onFirstMap([kill]), options)).not.toThrow();
  });
});

describe('pegadas de Rastro', () => {
  const caipora: TrailTarget = { encantadoId: 'caipora', remaining: 2 };
  const lucky = (): number => 0;

  it('surge uma pegada longe da personagem quando o tempo chega, e o que falta desce', () => {
    const scene = createScene({ trailTargets: [caipora], footprintTimer: 0.01 });
    const result = advanceScene(scene, null, STOPPED, 0.05, createSeededRandom(2));
    const footprint = result.scene.footprints[0];
    const distance = Math.hypot(
      (footprint?.x ?? 0) - scene.playerX,
      (footprint?.y ?? 0) - scene.playerY,
    );

    expect(result.scene.footprints).toHaveLength(1);
    expect(footprint?.encantadoId).toBe('caipora');
    expect(distance).toBeGreaterThanOrEqual(BALANCE.footprintMinSpawnDistance);
    expect(result.scene.trailTargets[0]?.remaining).toBe(1);
    expect(result.scene.footprintTimer).toBeCloseTo(scene.footprintIntervalSeconds, 6);
  });

  it('nunca surge mais pegada do que falta, nem mais que o teto no chão', () => {
    const one = { encantadoId: 'caipora', remaining: 1 };
    const scene = createScene({
      trailTargets: [one],
      footprintTimer: 0,
      footprintIntervalSeconds: 1,
    });
    const result = advanceScene(scene, null, STOPPED, 10, createSeededRandom(2));
    const crowded = createScene({
      trailTargets: [{ encantadoId: 'caipora', remaining: 10 }],
      footprintTimer: 0,
      footprintIntervalSeconds: 1,
    });
    const full = advanceScene(crowded, null, STOPPED, 10, createSeededRandom(2));

    expect(result.scene.footprints).toHaveLength(1);
    expect(result.scene.trailTargets[0]?.remaining).toBe(0);
    expect(full.scene.footprints).toHaveLength(BALANCE.footprintMaxOnMap);
  });

  it('sem ninguém precisando de Rastro, nenhuma pegada surge', () => {
    const scene = createScene({ footprintTimer: 0, footprintIntervalSeconds: 1 });
    const result = advanceScene(scene, null, STOPPED, 10, createSeededRandom(2));

    expect(result.scene.footprints).toEqual([]);
    expect(result.trails).toEqual([]);
  });

  it('passar por cima pega a pegada: vira Rastro no passo e some do chão', () => {
    const footprint = { uid: 1, encantadoId: 'caipora', x: 10.8, y: 11.5 };
    const scene = createScene({ footprints: [footprint] });
    const result = advanceScene(scene, null, STOPPED, 0.05, createSeededRandom(1));

    expect(result.trails).toEqual(['caipora']);
    expect(result.scene.footprints).toEqual([]);
    expect(result.events).toContainEqual({
      type: 'trail',
      x: 10.8,
      y: 11.5,
      encantadoId: 'caipora',
    });
  });

  it('com sorte, a visagem derrotada deixa uma pegada onde caiu', () => {
    const enemy = createEnemy(12.5, 11.5);
    const scene = createScene({ trailTargets: [caipora], attackProgress: 1, enemies: [enemy] });
    const result = advanceScene(scene, STRONG_FIGHTER, STOPPED, 0.5, lucky);

    const defeat = result.events.find((event) => event.type === 'defeat');

    expect(result.kills).toHaveLength(1);
    expect(result.scene.footprints).toEqual([
      { uid: 1, encantadoId: 'caipora', x: defeat?.x, y: defeat?.y },
    ]);
  });

  it('a chance de Rastro de quem sai encurta o intervalo entre pegadas', () => {
    const normal = createExpeditionScene(setupFor(null, [caipora]), createSeededRandom(1));
    const setup = { ...setupFor(null, [caipora]), trailChance: 2 };
    const doubled = createExpeditionScene(setup, createSeededRandom(1));

    expect(normal.footprintIntervalSeconds).toBe(BALANCE.footprintSpawnSeconds);
    expect(doubled.footprintIntervalSeconds).toBe(BALANCE.footprintSpawnSeconds / 2);
    expect(normal.footprintTimer).toBe(BALANCE.footprintSpawnSeconds / 2);
    expect(normal.trailTargets).toEqual([caipora]);
    expect(normal.trailTargets[0]).not.toBe(caipora); // cópia: a cena não mexe no que recebeu
  });

  it('as pegadas são de quem ainda precisa, na hora certa, menos o que já está na bolsa', () => {
    const game = createGame();
    const night = BALANCE.dayLengthMs * 0.75;
    const withBag = {
      ...game,
      expedition: {
        mapId: FIRST_MAP,
        encantadoId: 'saci',
        loot: [],
        trails: { caipora: 1 },
        preparationId: null,
      },
    };
    const withPact = { ...game, trails: { caipora: 3 } };

    expect(getTrailTargets(game, FIRST_MAP, 0)).toEqual([{ encantadoId: 'caipora', remaining: 3 }]);
    expect(getTrailTargets(game, FIRST_MAP, night)).toEqual([
      { encantadoId: 'caipora', remaining: 3 },
      { encantadoId: 'boitata', remaining: 5 },
    ]);
    expect(getTrailTargets(withBag, FIRST_MAP, 0)).toEqual([
      { encantadoId: 'caipora', remaining: 2 },
    ]);
    expect(getTrailTargets(withPact, FIRST_MAP, 0)).toEqual([]);
  });

  it('a bolsa guarda os Rastros e a volta entrega sem passar do que o pacto pede', () => {
    const game = createGameOnExpedition();
    const withTrails = addTrailsToLoot(game, ['caipora', 'caipora', 'caipora', 'caipora']);
    const result = finishExpedition(withTrails, 'voltou', 30, {
      startTimestamp: 0,
      random: createSeededRandom(1),
    });

    expect(withTrails.expedition?.trails).toEqual({ caipora: 4 });
    expect(countTrails(withTrails.expedition?.trails ?? {})).toBe(4);
    expect(addTrailsToLoot(game, [])).toBe(game);
    expect(result.state.trails.caipora).toBe(3);
    expect(result.report?.summary.trails.caipora).toBe(3);
  });

  it('uma bolsa só com Rastros também é entregue', () => {
    const game = createGame();
    const bag = { mapId: FIRST_MAP, kills: [], trails: { caipora: 2 } };
    const result = rewardExpeditionBag(game, bag, { startTimestamp: 0, random: lucky });

    expect(result.state.trails.caipora).toBe(2);
    expect(result.summary.kills).toBe(0);
  });
});

describe('preparos com Oferendas', () => {
  const withOfferings = (inventory: Record<string, number>): GameState => ({
    ...createGame(),
    inventory,
  });

  it('a partida sem preparo é neutra, e cada preparo muda só o que diz', () => {
    expect(getRunModifiers(null)).toEqual(NEUTRAL_RUN_MODIFIERS);
    expect(getRunModifiers('nada')).toEqual(NEUTRAL_RUN_MODIFIERS);
    expect(getRunModifiers('brasa-no-bornal')).toEqual({
      ...NEUTRAL_RUN_MODIFIERS,
      specialDamage: 2,
      specialCooldown: 2 / 3,
    });
    expect(getRunModifiers('favo-no-toco')).toEqual({
      ...NEUTRAL_RUN_MODIFIERS,
      spawnRate: 1.5,
      maxEnemies: 1.5,
    });
  });

  it('partir com preparo paga as Oferendas e guarda o preparo na expedição', () => {
    const game = withOfferings({ 'mel-silvestre': 5 });
    const started = startExpedition(game, FIRST_MAP, 'favo-no-toco');

    expect(started?.inventory['mel-silvestre']).toBe(2);
    expect(started?.expedition?.preparationId).toBe('favo-no-toco');
    expect(game.inventory['mel-silvestre']).toBe(5);
    expect(startExpedition(game, FIRST_MAP)?.inventory['mel-silvestre']).toBe(5);
  });

  it('sem Oferendas bastantes ou com preparo que não existe, não parte', () => {
    const game = withOfferings({ 'mel-silvestre': 2 });

    expect(canAffordPreparation(game, 'favo-no-toco')).toBe(false);
    expect(startExpedition(game, FIRST_MAP, 'favo-no-toco')).toBeNull();
    expect(startExpedition(game, FIRST_MAP, 'nada')).toBeNull();
    expect(canAffordPreparation(withOfferings({ 'brasa-viva': 1 }), 'brasa-no-bornal')).toBe(true);
  });

  it('a volta conta qual preparo foi usado', () => {
    const game = withOfferings({ 'brasa-viva': 1 });
    const started = startExpedition(game, FIRST_MAP, 'brasa-no-bornal');
    const result = started === null ? null : finishExpedition(started, 'voltou', 10, {
      startTimestamp: 0,
      random: createSeededRandom(1),
    });

    expect(result?.report?.preparationId).toBe('brasa-no-bornal');
  });

  it('a cena usa os modificadores: velocidade, dano recebido e teto de visagens', () => {
    const fast = createScene({ modifiers: { ...NEUTRAL_RUN_MODIFIERS, playerSpeed: 2 } });
    const right = { moveX: 1, moveY: 0, useSpecial: false };
    const moved = advanceScene(fast, null, right, 0.5, createSeededRandom(1));
    const fragile = createScene({
      modifiers: { ...NEUTRAL_RUN_MODIFIERS, damageTaken: 2 },
      enemies: [createEnemy(10.9, 11.5, { damage: 7 })],
    });
    const hurt = advanceScene(fragile, null, STOPPED, 0.05, createSeededRandom(1));
    const crowded = createScene({
      modifiers: getRunModifiers('favo-no-toco'),
      spawnTimer: 0,
      enemies: Array.from({ length: BALANCE.waveMaxEnemiesStart }, (_, index) =>
        createEnemy(20.5, 5.5, { uid: index + 1 }),
      ),
    });
    const spawned = advanceScene(crowded, null, STOPPED, 0.05, createSeededRandom(1));

    expect(moved.scene.playerX).toBeCloseTo(10.5 + BALANCE.playerSpeed, POSITION_DIGITS);
    expect(hurt.scene.playerHp).toBe(fragile.playerHp - 14);
    // Com o favo, o teto passa do normal: a visagem nova entra mesmo com o mapa "cheio"
    expect(spawned.scene.enemies).toHaveLength(BALANCE.waveMaxEnemiesStart + 1);
    // O intervalo do começo encurta um pouco com o tempo do passo, por isso a precisão menor
    expect(spawned.scene.spawnTimer).toBeCloseTo(BALANCE.waveSpawnSecondsStart / 1.5, 2);
  });

  it('a brasa dobra o dano do especial e encurta a recarga', () => {
    const target = createEnemy(12.5, 11.5, { damage: 0, hp: 1000, maxHp: 1000 });
    const scene = createScene({ modifiers: getRunModifiers('brasa-no-bornal'), enemies: [target] });
    const fighter = { ...STRONG_FIGHTER, damage: 2 };
    const special = { ...STOPPED, useSpecial: true };
    const result = advanceScene(scene, fighter, special, 0.5, createSeededRandom(1));

    expect(result.scene.enemies[0]?.hp).toBe(1000 - 2 * BALANCE.specialDamageMultiplier * 2);
    // O especial sai no primeiro pedaço do passo e a recarga já anda no resto dele
    const shortCooldown = (BALANCE.specialCooldownSeconds * 2) / 3;
    expect(result.scene.specialCooldown).toBeLessThanOrEqual(shortCooldown);
    expect(result.scene.specialCooldown).toBeGreaterThan(shortCooldown - 0.5);
  });

  it('a trilha de cipó faz as pegadas surgirem duas vezes mais rápido', () => {
    const setup = { ...setupFor(null), modifiers: getRunModifiers('trilha-de-cipo') };
    const scene = createExpeditionScene(setup, createSeededRandom(1));

    expect(scene.footprintIntervalSeconds).toBe(BALANCE.footprintSpawnSeconds / 2);
    expect(scene.modifiers).toEqual(getRunModifiers('trilha-de-cipo'));
    expect(scene.modifiers).not.toBe(setup.modifiers);
  });
});
