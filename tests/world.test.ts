/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/world.test.ts
 * O que faz: testa as regras do mundo aberto sem navegador: montagem da
 * cena, movimento com colisão, passagens, passeio e volta das visagens,
 * ataque automático, recompensas das derrotas no mapa e a conta da ausência.
 * O sorteio usa semente e as entradas são congeladas, para denunciar
 * qualquer alteração indevida.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE, MS_PER_SECOND } from '../src/data';
import { chooseStarter } from '../src/domain/actions';
import { getEnemy, getWorldMap } from '../src/domain/catalog';
import { getGoldReward } from '../src/domain/formulas';
import { getModifiers } from '../src/domain/modifiers';
import { rewardKills } from '../src/domain/simulation';
import { createInitialState } from '../src/domain/state';
import type { GameState, WorldEnemy, WorldFighter, WorldScene } from '../src/domain/types';
import {
  advanceWorld,
  createWorldScene,
  getWorldFighter,
  isWalkablePosition,
  recordWorldStep,
} from '../src/domain/world';
import { applyWorldOfflineProgress, getAfkKillsPerSecond } from '../src/domain/worldOffline';
import { createSeededRandom } from '../src/utils/random';

const FIRST_MAP = 'beira-da-mata';
const SECOND_MAP = 'brejo-escuro';
const STOPPED = { moveX: 0, moveY: 0 };
const ONE_HOUR_MS = 3600 * MS_PER_SECOND;

// Folga para comparar posições depois de muitos passos curtos
const POSITION_DIGITS = 6;

// Congela o objeto inteiro. Alterar um objeto congelado lança erro nos testes.
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

// Cena montada à mão, sem visagens sorteadas, para os testes que medem posição e golpe
function createScene(changes: Partial<WorldScene> = {}): WorldScene {
  return deepFreeze({
    mapId: FIRST_MAP,
    playerX: 5.5,
    playerY: 11.5,
    attackProgress: 0,
    enemies: [],
    respawnTimers: [],
    nextEnemyUid: 10,
    ...changes,
  });
}

// Visagem parada num ponto, com a vida pedida
function createEnemy(x: number, y: number, hp: number): WorldEnemy {
  return {
    uid: 1,
    enemyId: 'visagem-da-neblina',
    x,
    y,
    hp,
    maxHp: hp,
    targetX: x,
    targetY: y,
    waitSeconds: 100,
  };
}

// Quem bate, com números redondos
const STRONG_FIGHTER: WorldFighter = {
  encantadoId: 'saci',
  damage: 1000,
  attackInterval: 1,
  critChance: 0,
};

// Jogo com o Saci na comitiva
function createGame(): GameState {
  const started = chooseStarter(createInitialState(0, createSeededRandom(1)), 'saci');

  if (started === null) {
    throw new Error('O Saci deveria ser um encantado inicial.');
  }

  return deepFreeze(started);
}

describe('montagem da cena', () => {
  it('põe a personagem no início e as visagens longe dela, em lugar livre', () => {
    const map = getWorldMap(FIRST_MAP);
    const scene = createWorldScene(FIRST_MAP, null, createSeededRandom(3));
    const uids = scene.enemies.map((enemy) => enemy.uid);

    expect(scene.playerX).toBe(map.start.x + 0.5);
    expect(scene.playerY).toBe(map.start.y + 0.5);
    expect(scene.enemies).toHaveLength(map.maxEnemies);
    expect(new Set(uids).size).toBe(uids.length);

    for (const enemy of scene.enemies) {
      const distance = Math.hypot(enemy.x - scene.playerX, enemy.y - scene.playerY);
      expect(isWalkablePosition(map, enemy.x, enemy.y)).toBe(true);
      expect(distance).toBeGreaterThanOrEqual(BALANCE.enemyMinSpawnDistance);
      expect(map.enemyIds).toContain(enemy.enemyId);
    }
  });

  it('troca uma posição dentro de árvore pelo início do mapa', () => {
    const map = getWorldMap(FIRST_MAP);
    const scene = createWorldScene(FIRST_MAP, { x: 0.5, y: 0.5 }, createSeededRandom(3));
    expect(scene.playerX).toBe(map.start.x + 0.5);
  });

  it('não aceita posição que não é número', () => {
    expect(isWalkablePosition(getWorldMap(FIRST_MAP), Number.NaN, 5)).toBe(false);
  });
});

describe('movimento', () => {
  it('anda na velocidade combinada e não altera a cena recebida', () => {
    const scene = createScene();
    const input = deepFreeze({ moveX: 1, moveY: 0 });
    const result = advanceWorld(scene, null, input, 1, createSeededRandom(1));

    expect(result.scene.playerX).toBeCloseTo(5.5 + BALANCE.playerSpeed, POSITION_DIGITS);
    expect(result.scene.playerY).toBe(11.5);
    expect(scene.playerX).toBe(5.5);
  });

  it('anda na diagonal com a mesma velocidade', () => {
    const scene = createScene({ playerX: 3.5, playerY: 11.5 });
    const seconds = 0.25;
    const result = advanceWorld(scene, null, { moveX: 1, moveY: 1 }, seconds, Math.random);
    const walked = Math.hypot(result.scene.playerX - 3.5, result.scene.playerY - 11.5);

    expect(walked).toBeCloseTo(BALANCE.playerSpeed * seconds, POSITION_DIGITS);
  });

  it('para ao encostar numa árvore', () => {
    // A linha 0 do mapa é toda de árvores
    const scene = createScene({ playerX: 1.5, playerY: 1.5 });
    const result = advanceWorld(scene, null, { moveX: 0, moveY: -1 }, 1, Math.random);

    expect(result.scene.playerY).toBeGreaterThanOrEqual(1 + BALANCE.bodyRadius);
    expect(result.scene.playerY).toBeLessThan(1.5);
    expect(result.scene.playerX).toBe(1.5);
  });

  it('não faz nada com tempo zero ou inválido', () => {
    const scene = createScene();
    expect(advanceWorld(scene, null, STOPPED, 0, Math.random).scene).toBe(scene);
    expect(advanceWorld(scene, null, STOPPED, Number.NaN, Math.random).scene).toBe(scene);
  });
});

describe('passagens', () => {
  it('leva para o outro mapa ao pisar na passagem', () => {
    // A passagem da Beira da Mata fica na coluna 30, linha 10
    const scene = createScene({ playerX: 29.5, playerY: 10.5 });
    const result = advanceWorld(scene, null, { moveX: 1, moveY: 0 }, 0.4, createSeededRandom(2));

    expect(result.scene.mapId).toBe(SECOND_MAP);
    expect(result.scene.playerY).toBe(10.5);
    expect(result.scene.playerX).toBeGreaterThanOrEqual(2.5);
    expect(result.scene.enemies).toHaveLength(getWorldMap(SECOND_MAP).maxEnemies);
    expect(result.events).toContainEqual({ type: 'mapChanged', mapId: SECOND_MAP });
  });
});

describe('ataque automático', () => {
  it('bate na visagem dentro do alcance e conta a derrota', () => {
    const scene = createScene({ attackProgress: 1, enemies: [createEnemy(6.5, 11.5, 10)] });
    const result = advanceWorld(scene, STRONG_FIGHTER, STOPPED, 0.05, createSeededRandom(1));

    expect(result.scene.enemies).toEqual([]);
    expect(result.scene.respawnTimers).toEqual([BALANCE.enemyRespawnSeconds]);
    expect(result.scene.attackProgress).toBe(0);
    expect(result.kills).toEqual([
      { enemyId: 'visagem-da-neblina', stage: 1, zoneId: 'mata-atlantica' },
    ]);
    expect(result.events.map((event) => event.type)).toEqual(['hit', 'defeat']);
  });

  it('não bate em visagem longe e deixa a barra cheia esperando', () => {
    const scene = createScene({ attackProgress: 1, enemies: [createEnemy(9.5, 11.5, 10)] });
    const result = advanceWorld(scene, STRONG_FIGHTER, STOPPED, 0.5, createSeededRandom(1));

    expect(result.kills).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.scene.attackProgress).toBe(1);
  });

  it('precisa de vários golpes para visagem com mais vida', () => {
    const weak = { ...STRONG_FIGHTER, damage: 4, attackInterval: 0.5 };
    const scene = createScene({ enemies: [createEnemy(6.5, 11.5, 10)] });
    const result = advanceWorld(scene, weak, STOPPED, 1.2, createSeededRandom(1));

    expect(result.scene.enemies[0]?.hp).toBe(2);
    expect(result.kills).toEqual([]);
  });

  it('sem quem bata, a personagem só anda', () => {
    const scene = createScene({ attackProgress: 1, enemies: [createEnemy(6.5, 11.5, 10)] });
    const result = advanceWorld(scene, null, STOPPED, 1, createSeededRandom(1));
    expect(result.scene.enemies[0]?.hp).toBe(10);
  });

  it('a visagem derrotada volta depois do tempo combinado', () => {
    const scene = createScene({ respawnTimers: [0.1] });
    const result = advanceWorld(scene, null, STOPPED, 0.2, createSeededRandom(4));

    expect(result.scene.respawnTimers).toEqual([]);
    expect(result.scene.enemies).toHaveLength(1);
    expect(result.scene.enemies[0]?.uid).toBe(10);
  });
});

describe('personagem e recompensas', () => {
  it('quem anda é o primeiro da comitiva, com as fórmulas de sempre', () => {
    const game = createGame();
    const fighter = getWorldFighter(game, 0);
    const modifiers = getModifiers(game, 'dia');
    const expectedDamage = 3 * (1 + BALANCE.damagePerLevel) * modifiers.damage;

    expect(getWorldFighter(createInitialState(0, Math.random), 0)).toBeNull();
    expect(fighter?.encantadoId).toBe('saci');
    expect(fighter?.damage).toBeCloseTo(expectedDamage, POSITION_DIGITS);
  });

  it('entrega Patacas e XP das derrotas sem mexer nos estágios', () => {
    const game = createGame();
    const enemy = getEnemy('visagem-da-neblina');
    const kills = [{ enemyId: enemy.id, stage: 4, zoneId: 'mata-atlantica' }];
    const result = rewardKills(game, kills, { startTimestamp: 0, random: createSeededRandom(5) });
    const modifiers = getModifiers(game, 'dia');

    expect(result.state.gold).toBe(getGoldReward(4, enemy, false, modifiers.gold));
    expect(result.state.stats.totalKills).toBe(1);
    expect(result.state.roster.saci?.xp).toBeGreaterThan(0);
    expect(result.state.stage).toBe(game.stage);
    expect(result.state.combat).toEqual(game.combat);
  });

  it('lista vazia de derrotas devolve o mesmo estado', () => {
    const game = createGame();
    expect(rewardKills(game, [], { startTimestamp: 0, random: Math.random }).state).toBe(game);
  });

  it('grava a posição e o tempo de jogo de um passo', () => {
    const game = createGame();
    const scene = createScene({ mapId: SECOND_MAP, playerX: 3.25, playerY: 9.75 });
    const next = recordWorldStep(game, scene, 2);

    expect(next.world).toEqual({ mapId: SECOND_MAP, x: 3.25, y: 9.75 });
    expect(next.stats.playTimeSeconds).toBe(game.stats.playTimeSeconds + 2);
    expect(next.editionSeconds).toBe(game.editionSeconds + 2);
  });
});

describe('ausência no mapa', () => {
  it('rende as derrotas do ritmo do mapa, pela metade do tempo', () => {
    const game = createGame();
    const now = ONE_HOUR_MS;
    const result = applyWorldOfflineProgress(game, now, createSeededRandom(6));
    const rate = getAfkKillsPerSecond(game, getWorldMap(FIRST_MAP), 0);
    const expectedKills = Math.floor(3600 * BALANCE.offlineEfficiency * rate);

    expect(result.report?.summary.kills).toBe(expectedKills);
    expect(result.report?.secondsSimulated).toBe(3600 * BALANCE.offlineEfficiency);
    expect(result.state.gold).toBeGreaterThan(0);
    expect(result.state.lastSaveTimestamp).toBe(now);
  });

  it('respeita o teto da ausência', () => {
    const game = createGame();
    const result = applyWorldOfflineProgress(game, 48 * ONE_HOUR_MS, createSeededRandom(6));
    const cap = BALANCE.offlineCapSeconds * BALANCE.offlineEfficiency;
    expect(result.report?.secondsSimulated).toBe(cap);
  });

  it('sem comitiva nada rende', () => {
    const empty = deepFreeze(createInitialState(0, createSeededRandom(1)));
    const result = applyWorldOfflineProgress(empty, ONE_HOUR_MS, Math.random);

    expect(result.report).toBeNull();
    expect(result.state.lastSaveTimestamp).toBe(ONE_HOUR_MS);
  });
});
