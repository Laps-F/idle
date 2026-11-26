/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/expedition.test.ts
 * O que faz: testa as regras da expedição sem navegador. Na cena: montagem,
 * movimento com colisão, passagem de volta, perseguição, encostada, queda,
 * golpe automático, golpe especial, ondas e fim do tempo. Fora da cena: quem
 * sai, partir, bolsa e a volta com o bônus. O sorteio usa semente e as
 * entradas são congeladas, para denunciar qualquer alteração indevida.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE } from '../src/data';
import { chooseStarter } from '../src/domain/actions';
import { getEnemy, getExpeditionMap } from '../src/domain/catalog';
import {
  addKillsToLoot,
  countLoot,
  finishExpedition,
  getExpeditionFighter,
  startExpedition,
} from '../src/domain/expedition';
import {
  advanceScene,
  createExpeditionScene,
  getWaveLevel,
  isWalkablePosition,
} from '../src/domain/expeditionScene';
import { getEnemyContactDamage, getExpeditionMaxHp } from '../src/domain/formulas';
import { getModifiers } from '../src/domain/modifiers';
import { createInitialState } from '../src/domain/state';
import type {
  ExpeditionFighter,
  ExpeditionScene,
  GameState,
  SceneEnemy,
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
    elapsedSeconds: 0,
    playerX: 10.5,
    playerY: 11.5,
    playerHp: 100,
    playerMaxHp: 100,
    hurtSeconds: 0,
    attackProgress: 0,
    specialCooldown: 0,
    enemies: [],
    spawnTimer: 999,
    nextEnemyUid: 10,
    ...changes,
  });
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
    },
  });
}

describe('montagem da cena', () => {
  it('põe a personagem no início, com vida cheia, e as visagens longe dela', () => {
    const map = getExpeditionMap(FIRST_MAP);
    const scene = createExpeditionScene(FIRST_MAP, 130, createSeededRandom(3));

    expect(scene.playerX).toBe(map.start.x + 0.5);
    expect(scene.playerHp).toBe(130);
    expect(scene.playerMaxHp).toBe(130);
    expect(scene.enemies).toHaveLength(BALANCE.waveStartEnemies);

    for (const enemy of scene.enemies) {
      const distance = Math.hypot(enemy.x - scene.playerX, enemy.y - scene.playerY);
      expect(isWalkablePosition(map, enemy.x, enemy.y)).toBe(true);
      expect(distance).toBeGreaterThanOrEqual(BALANCE.enemyMinSpawnDistance);
      expect(enemy.level).toBe(map.level);
    }
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
    expect(result.scene.enemies[0]?.level).toBe(map.level + 2);
    expect(getWaveLevel(map, 59)).toBe(map.level);
    expect(getWaveLevel(map, 60)).toBe(map.level + 1);
  });

  it('a expedição termina como "concluida" no fim do tempo', () => {
    const scene = createScene({ elapsedSeconds: BALANCE.expeditionDurationSeconds - 0.01 });
    const result = advanceScene(scene, null, STOPPED, 1, createSeededRandom(1));

    expect(result.outcome).toBe('concluida');
  });
});

describe('golpes', () => {
  it('o golpe automático derruba a visagem no alcance e conta o nível dela', () => {
    const enemy = createEnemy(11.5, 11.5, { level: 3, damage: 0 });
    const scene = createScene({ attackProgress: 1, enemies: [enemy] });
    const result = advanceScene(scene, STRONG_FIGHTER, STOPPED, 0.05, createSeededRandom(1));

    expect(result.scene.enemies).toEqual([]);
    expect(result.kills).toEqual([
      { enemyId: 'visagem-da-neblina', stage: 3, zoneId: 'mata-atlantica' },
    ]);
    expect(result.events.map((event) => event.type)).toEqual(['hit', 'defeat']);
  });

  it('o golpe especial acerta todas em volta e precisa recarregar', () => {
    const fighter = { ...STRONG_FIGHTER, damage: 2 };
    const enemies = [
      createEnemy(12, 11.5, { uid: 1, damage: 0, hp: 100, maxHp: 100 }),
      createEnemy(10.5, 13.5, { uid: 2, damage: 0, hp: 100, maxHp: 100 }),
      createEnemy(14.5, 11.5, { uid: 3, damage: 0, hp: 100, maxHp: 100, waitSeconds: 100 }),
    ];
    const scene = createScene({ attackProgress: 0, enemies });
    const special = { ...STOPPED, useSpecial: true };
    const first = advanceScene(scene, fighter, special, 0.05, createSeededRandom(1));
    const again = advanceScene(first.scene, fighter, special, 0.05, createSeededRandom(1));
    const hpOf = (result: typeof first, uid: number): number | undefined =>
      result.scene.enemies.find((enemy) => enemy.uid === uid)?.hp;
    const specialDamage = fighter.damage * BALANCE.specialDamageMultiplier;

    expect(hpOf(first, 1)).toBe(100 - specialDamage);
    expect(hpOf(first, 2)).toBe(100 - specialDamage);
    expect(hpOf(first, 3)).toBe(100);
    expect(first.scene.specialCooldown).toBeCloseTo(BALANCE.specialCooldownSeconds, 6);
    expect(first.events).toContainEqual({ type: 'special', x: 10.5, y: 11.5, radius: 2.5 });
    expect(hpOf(again, 1)).toBe(100 - specialDamage);
  });
});

describe('fórmulas da expedição', () => {
  it('a vida cresce com o nível e o dano das visagens com o nível delas', () => {
    expect(getExpeditionMaxHp(1)).toBe(BALANCE.playerBaseHp);
    expect(getExpeditionMaxHp(11)).toBe(BALANCE.playerBaseHp * 2);
    const levelFive = Math.ceil(BALANCE.enemyDamageBase * BALANCE.enemyDamageGrowth ** 4);
    expect(getEnemyContactDamage(1, getEnemy('visagem-da-neblina'))).toBe(BALANCE.enemyDamageBase);
    expect(getEnemyContactDamage(5, getEnemy('visagem-da-neblina'))).toBe(levelFive);
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
    expect(started?.expedition).toEqual({ mapId: FIRST_MAP, encantadoId: 'saci', loot: [] });
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
