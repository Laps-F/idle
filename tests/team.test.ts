/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/team.test.ts
 * O que faz: confere o revezamento da expedição (src/domain/expeditionTeam.ts):
 * quem sai, a troca pelas teclas 1, 2 e 3, a recarga da troca, o golpe de quem
 * espera a vez, quem cai e o fim da expedição quando todos caem.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE } from '../src/data';
import { chooseStarter } from '../src/domain/actions';
import {
  finishExpedition,
  getExpeditionFighters,
  getSceneSetup,
  startExpedition,
} from '../src/domain/expedition';
import { NEUTRAL_RUN_MODIFIERS } from '../src/domain/expeditionModifiers';
import { getFighterBaseLevel, getTeamBaseLevel } from '../src/domain/expeditionScaling';
import { advanceScene, createExpeditionScene } from '../src/domain/expeditionScene';
import { getFallenIds } from '../src/domain/expeditionTeam';
import { createInitialState } from '../src/domain/state';
import type {
  ExpeditionFighter,
  ExpeditionScene,
  GameState,
  SceneEnemy,
} from '../src/domain/types';
import { createSeededRandom } from '../src/utils/random';

// =============================================================================
// =============================================================================
// M O N T A G E M

const FIRST_MAP = 'beira-da-mata';
const STOPPED = { moveX: 0, moveY: 0, useSpecial: false };

// Quem sai. Não ataca sozinho (intervalo enorme), para medir só o revezamento.
function fighterFor(encantadoId: string, maxHp: number, damage = 10): ExpeditionFighter {
  return { encantadoId, damage, attackInterval: 1e9, critChance: 0, maxHp };
}

const TRIO = [fighterFor('saci', 100), fighterFor('iara', 120), fighterFor('curupira', 140)];

// Cena do time de três, sem visagens nem ondas, no meio da linha livre da Beira da Mata
function createTeamScene(changes: Partial<ExpeditionScene> = {}): ExpeditionScene {
  const setup = {
    mapId: FIRST_MAP,
    fighters: TRIO,
    trailTargets: [],
    trailChance: 1,
    modifiers: { ...NEUTRAL_RUN_MODIFIERS },
  };
  const scene = createExpeditionScene(setup, createSeededRandom(1));
  return {
    ...scene,
    playerX: 10.5,
    playerY: 11.5,
    enemies: [],
    spawnTimer: 999,
    footprintTimer: 999,
    ...changes,
  };
}

// Visagem encostada na personagem, que bate "damage" a cada encostada
function createBiter(damage: number): SceneEnemy {
  return {
    uid: 1,
    enemyId: 'visagem-da-neblina',
    level: 1,
    x: 10.7,
    y: 11.5,
    hp: 1e9,
    maxHp: 1e9,
    damage,
    hitCooldown: 0,
    targetX: 10.7,
    targetY: 11.5,
    waitSeconds: 100,
    slowSeconds: 0,
    slowMultiplier: 1,
    confusedSeconds: 0,
    burnSeconds: 0,
    burnDps: 0,
    burnTickSeconds: 0,
  };
}

// Jogo com a comitiva de três (Saci, Iara e Curupira, todos nível 1)
function createTrioGame(): GameState {
  const game = chooseStarter(createInitialState(0, createSeededRandom(1)), 'saci');

  if (game === null) {
    throw new Error('O Saci deveria ser um encantado inicial.');
  }

  const owned = (id: string) => ({ id, level: 1, xp: 0, bond: 0 });
  return {
    ...game,
    roster: { ...game.roster, iara: owned('iara'), curupira: owned('curupira') },
    party: ['saci', 'iara', 'curupira'],
  };
}

function swap(index: number) {
  return { ...STOPPED, swapTo: index };
}


// =============================================================================
// =============================================================================
// Q U E M   S A I

describe('quem sai no revezamento', () => {
  it('a comitiva inteira sai, na ordem dela, e a primeira entra em campo', () => {
    const started = startExpedition(createTrioGame(), FIRST_MAP);

    expect(started?.expedition?.encantadoId).toBe('saci');
    expect(started?.expedition?.team).toEqual(['saci', 'iara', 'curupira']);

    const setup = started === null ? null : getSceneSetup(started, 0);
    expect(setup?.fighters.map((fighter) => fighter.encantadoId)).toEqual([
      'saci',
      'iara',
      'curupira',
    ]);
  });

  it('o nível de partida sai da média do dano, e a encostada, da média da vida', () => {
    const fighters = [fighterFor('saci', 100, 4), fighterFor('iara', 200, 20)];
    const setup = {
      mapId: FIRST_MAP,
      fighters,
      trailTargets: [],
      trailChance: 1,
      modifiers: { ...NEUTRAL_RUN_MODIFIERS },
    };
    const scene = createExpeditionScene(setup, createSeededRandom(1));

    expect(getTeamBaseLevel(fighters)).toBe(getFighterBaseLevel(12));
    expect(scene.baseLevel).toBe(getFighterBaseLevel(12));
    expect(scene.contactBaseHp).toBe(150);
    expect(scene.playerMaxHp).toBe(100);
    expect(scene.team.map((member) => member.hp)).toEqual([100, 200]);
  });

  it('os números de quem saiu vêm de quem está na expedição, não da comitiva de agora', () => {
    const started = startExpedition(createTrioGame(), FIRST_MAP);

    if (started === null) {
      throw new Error('Deveria partir.');
    }

    const changed = { ...started, party: ['iara'] };
    expect(getExpeditionFighters(changed, 0).map((fighter) => fighter.encantadoId)).toEqual([
      'saci',
      'iara',
      'curupira',
    ]);
  });
});


// =============================================================================
// =============================================================================
// T R O C A

describe('troca de quem está em campo', () => {
  it('troca pela posição, guarda a vida de quem sai e começa a recarga da troca', () => {
    const scene = createTeamScene({ playerHp: 60 });
    const result = advanceScene(scene, TRIO, swap(2), 0.05, createSeededRandom(1));
    const next = result.scene;

    expect(next.activeIndex).toBe(2);
    expect(next.playerMaxHp).toBe(140);
    expect(next.playerHp).toBe(140);
    expect(next.team[0]?.hp).toBe(60);
    expect(next.swapCooldown).toBeCloseTo(BALANCE.swapCooldownSeconds, 6);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'swap', encantadoId: 'curupira' }),
    );
  });

  it('na recarga da troca, para quem já está em campo ou para quem não existe, não troca', () => {
    const swapped = advanceScene(createTeamScene(), TRIO, swap(1), 0.05, createSeededRandom(1));
    const again = advanceScene(swapped.scene, TRIO, swap(0), 0.05, createSeededRandom(1));
    const self = advanceScene(createTeamScene(), TRIO, swap(0), 0.05, createSeededRandom(1));
    const missing = advanceScene(createTeamScene(), TRIO, swap(7), 0.05, createSeededRandom(1));

    expect(again.scene.activeIndex).toBe(1);
    expect(self.scene.swapCooldown).toBe(0);
    expect(missing.scene.activeIndex).toBe(0);

    // Passada a recarga, troca de novo
    const waited = advanceScene(again.scene, TRIO, STOPPED, 3, createSeededRandom(1));
    const back = advanceScene(waited.scene, TRIO, swap(0), 0.05, createSeededRandom(1));
    expect(back.scene.activeIndex).toBe(0);
  });

  it('quem entra bate com os próprios números', () => {
    const quickIara = { ...fighterFor('iara', 120, 77), attackInterval: 0.1 };
    const fighters = [fighterFor('saci', 100), quickIara];
    const enemy = { ...createBiter(0), x: 12.5, y: 11.5 };
    const scene = createTeamScene({ enemies: [enemy] });
    const result = advanceScene(scene, fighters, swap(1), 1, createSeededRandom(1));

    expect(result.events).toContainEqual(expect.objectContaining({ type: 'hit', damage: 77 }));
  });

  it('o golpe de quem espera a vez continua recarregando', () => {
    const special = { ...STOPPED, useSpecial: true };
    const used = advanceScene(createTeamScene(), TRIO, special, 0.05, createSeededRandom(1));
    const total = used.scene.specialCooldownTotal;
    const away = advanceScene(used.scene, TRIO, swap(1), 0.05, createSeededRandom(1));
    const waited = advanceScene(away.scene, TRIO, STOPPED, total, createSeededRandom(1));

    expect(away.scene.team[0]?.specialCooldown).toBeGreaterThan(0);
    expect(waited.scene.team[0]?.specialCooldown).toBe(0);
  });
});


// =============================================================================
// =============================================================================
// Q U E M   C A I

describe('quem cai', () => {
  it('quem cai fica fora, o próximo entra sem levar golpe um tempo, e a expedição segue', () => {
    const scene = createTeamScene({ enemies: [createBiter(1000)] });
    const result = advanceScene(scene, TRIO, STOPPED, 0.05, createSeededRandom(1));
    const next = result.scene;

    expect(result.outcome).toBeNull();
    expect(next.team[0]?.isDown).toBe(true);
    expect(next.activeIndex).toBe(1);
    expect(next.playerHp).toBe(120);
    expect(next.invulnerableSeconds).toBeGreaterThan(0);
    expect(getFallenIds(next)).toEqual(['saci']);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'fall', encantadoId: 'saci' }),
    );

    // Quem caiu não volta
    const later = advanceScene(next, TRIO, STOPPED, 3, createSeededRandom(1));
    const tryBack = advanceScene(
      { ...later.scene, enemies: [] },
      TRIO,
      swap(0),
      0.05,
      createSeededRandom(1),
    );
    expect(tryBack.scene.activeIndex).not.toBe(0);
  });

  it('a expedição só termina em "caiu" quando todos caem', () => {
    const scene = createTeamScene({ enemies: [createBiter(1000)] });
    const result = advanceScene(scene, TRIO, STOPPED, 10, createSeededRandom(1));

    expect(result.outcome).toBe('caiu');
    expect(getFallenIds(result.scene)).toEqual(['saci', 'iara', 'curupira']);
  });

  it('a volta conta no relatório quem saiu e quem caiu', () => {
    const started = startExpedition(createTrioGame(), FIRST_MAP);

    if (started === null) {
      throw new Error('Deveria partir.');
    }

    const options = { startTimestamp: 0, random: createSeededRandom(2) };
    const result = finishExpedition(started, 'voltou', 30, options, ['iara']);

    expect(result.report?.team).toEqual(['saci', 'iara', 'curupira']);
    expect(result.report?.fallen).toEqual(['iara']);
  });
});
