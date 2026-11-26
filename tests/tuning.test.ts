// @vitest-environment jsdom
/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/tuning.test.ts
 * O que faz: testa os ajustes de teste (src/store/tuning.ts): a lista de
 * campos, a troca de valor na hora, a conferência do valor, a gravação no
 * localStorage, o desfazer, o efeito no jogo e as ações da store ligadas a
 * eles. Cada teste desfaz tudo no fim, para um ajuste não vazar para outro.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BALANCE, ENEMIES, EXPEDITION_MAPS } from '../src/data';
import { chooseStarter } from '../src/domain/actions';
import { getExpeditionFighter } from '../src/domain/expedition';
import { createExpeditionScene } from '../src/domain/expeditionScene';
import { createInitialState } from '../src/domain/state';
import {
  countTuningChanges,
  describeTuningChanges,
  listTuningFields,
  loadSavedTuning,
  resetTuning,
  setTuningValue,
  TUNING_STORAGE_KEY,
} from '../src/store/tuning';
import { useGameStore } from '../src/store/useGameStore';
import { createSeededRandom } from '../src/utils/random';

beforeEach(() => {
  localStorage.clear();
  resetTuning(null);
});

afterEach(() => {
  resetTuning(null);
  localStorage.clear();
});

// Valor guardado no localStorage, ou null
function readSaved(): Record<string, number> | null {
  const text = localStorage.getItem(TUNING_STORAGE_KEY);
  return text === null ? null : (JSON.parse(text) as Record<string, number>);
}

describe('lista de ajustes', () => {
  it('traz as constantes e os números de cada dado, todos começando iguais ao código', () => {
    const ids = listTuningFields().map((field) => field.id);

    for (const id of [
      'balance.enemyBaseHp',
      'balance.enemyHpGrowth',
      'balance.xpBase',
      'balance.playerBaseHp',
      'balance.playerHpPerLevel',
      'balance.enemyContactHpFraction',
      'balance.expeditionHitsPerEnemy',
      'balance.waveSpawnSecondsStart',
      'map.beira-da-mata.levelBonus',
      'enemy.visagem-da-neblina.hpMultiplier',
      'enemy.visagem-da-neblina.drop0.chance',
      'encantado.saci.baseAttack',
      'upgrade.reza-forte.baseCost',
      'zone.mata-atlantica.killsToBoss',
    ]) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('balance.saveVersion');
    expect(countTuningChanges()).toBe(0);
  });
});

describe('mudar e desfazer', () => {
  it('troca o valor na hora, guarda no navegador e desfaz', () => {
    const original = BALANCE.enemyBaseHp;

    expect(setTuningValue('balance.enemyBaseHp', 25)).toBe(true);
    expect(BALANCE.enemyBaseHp).toBe(25);
    expect(readSaved()).toEqual({ 'balance.enemyBaseHp': 25 });
    expect(describeTuningChanges()).toBe(`src/data/balance.ts, enemyBaseHp: ${original} -> 25`);

    resetTuning('balance.enemyBaseHp');
    expect(BALANCE.enemyBaseHp).toBe(original);
    expect(readSaved()).toBeNull();
  });

  it('recusa valor que não é número, abaixo do mínimo ou de campo que não existe', () => {
    expect(setTuningValue('balance.enemyBaseHp', Number.NaN)).toBe(false);
    expect(setTuningValue('balance.enemyBaseHp', 0)).toBe(false);
    expect(setTuningValue('balance.goldBase', -1)).toBe(false);
    expect(setTuningValue('nada', 3)).toBe(false);
    expect(countTuningChanges()).toBe(0);
  });

  it('arredonda os campos de número inteiro', () => {
    setTuningValue('map.beira-da-mata.levelBonus', 3.6);
    expect(EXPEDITION_MAPS[0]?.levelBonus).toBe(4);
  });

  it('aplica o que estava guardado e ignora o que não serve', () => {
    localStorage.setItem(
      TUNING_STORAGE_KEY,
      JSON.stringify({
        'balance.xpBase': 9,
        'enemy.visagem-da-neblina.drop0.chance': 0.5,
        nada: 1,
        'balance.goldBase': 'x',
      }),
    );

    expect(loadSavedTuning()).toBe(2);
    expect(BALANCE.xpBase).toBe(9);
    expect(ENEMIES[0]?.drops[0]?.chance).toBe(0.5);
  });

  it('não quebra com texto estragado no navegador', () => {
    localStorage.setItem(TUNING_STORAGE_KEY, '{estragado');
    expect(loadSavedTuning()).toBe(0);
  });
});

describe('efeito no jogo', () => {
  it('a vida da personagem e o nível das visagens seguem os ajustes', () => {
    const game = chooseStarter(createInitialState(0, createSeededRandom(1)), 'saci');

    setTuningValue('balance.playerBaseHp', 250);
    setTuningValue('map.beira-da-mata.levelBonus', 6);
    const fighter = game === null ? null : getExpeditionFighter(game, 0);
    const setup = { mapId: 'beira-da-mata', fighter, trailTargets: [], trailChance: 1 };
    const scene = createExpeditionScene(setup, createSeededRandom(2));

    expect(fighter?.maxHp).toBe(250);
    expect(scene.enemies.every((enemy) => enemy.level === 7)).toBe(true);
  });
});

describe('ações da store', () => {
  it('setTuning e resetTuning avisam a tela pelo tuningVersion', () => {
    const before = useGameStore.getState().tuningVersion;

    expect(useGameStore.getState().setTuning('balance.goldBase', 7)).toBe(true);
    expect(BALANCE.goldBase).toBe(7);
    expect(useGameStore.getState().tuningVersion).toBe(before + 1);

    useGameStore.getState().resetTuning(null);
    expect(countTuningChanges()).toBe(0);
    expect(useGameStore.getState().tuningVersion).toBe(before + 2);
  });

  it('põe o primeiro da comitiva no nível pedido', () => {
    useGameStore.getState().hardReset();
    expect(useGameStore.getState().debugSetLeaderLevel(5)).toBe(false);

    useGameStore.getState().chooseStarter('saci');
    expect(useGameStore.getState().debugSetLeaderLevel(12)).toBe(true);
    expect(useGameStore.getState().roster.saci?.level).toBe(12);
    expect(useGameStore.getState().debugSetLeaderLevel(0)).toBe(false);
  });
});
