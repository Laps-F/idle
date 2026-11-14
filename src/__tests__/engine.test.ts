/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/__tests__/engine.test.ts
 * O que faz: testa o motor sem navegador: fórmulas, relógio, combate,
 * pactos e progresso offline.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE, MS_PER_SECOND, getEnemy, getUpgrade } from '../data';
import { getDayPhase, getMoonPhase, getSecondsToNextDayPhase } from '../engine/clock';
import {
  getEnemyMaxHp,
  getGoldReward,
  getRootsForRebrota,
  getUpgradeCost,
  getXpToNextLevel,
} from '../engine/formulas';
import { getActiveSynergies } from '../engine/modifiers';
import { applyOfflineProgress } from '../engine/offline';
import { getPactStatus, sealPact } from '../engine/pact';
import { advanceSimulation } from '../engine/simulation';
import { createInitialState } from '../engine/state';
import type { GameState } from '../types/game';
import { createSeededRandom } from '../utils/random';

const START = 0; // começo de um dia do jogo
const NIGHT = BALANCE.dayLengthMs * 0.75;

// Jogo novo com um encantado inicial já escolhido
function createGameWith(encantadoId: string, seed = 1): GameState {
  const state = createInitialState(START, createSeededRandom(seed));
  state.roster[encantadoId] = { id: encantadoId, level: 1, xp: 0, bond: 0 };
  state.party = [encantadoId];
  return state;
}

describe('fórmulas', () => {
  it('segue os números do GDD', () => {
    const visagem = getEnemy('visagem-da-neblina');
    expect(getEnemyMaxHp(1, visagem, false)).toBe(10);
    expect(getEnemyMaxHp(1, getEnemy('corpo-seco'), true)).toBe(80);
    expect(getGoldReward(1, visagem, false, 1)).toBe(2);
    expect(getXpToNextLevel(1)).toBe(20);
    expect(getUpgradeCost(getUpgrade('reza-forte'), 0)).toBe(10);
    expect(getUpgradeCost(getUpgrade('reza-forte'), 1)).toBe(12);
    expect(getRootsForRebrota(40)).toBe(8);
  });
});

describe('relógio do sertão', () => {
  it('alterna dia e noite a cada 12 minutos', () => {
    const twelveMinutes = 12 * 60 * MS_PER_SECOND;
    expect(getDayPhase(0)).toBe('dia');
    expect(getDayPhase(twelveMinutes - 1)).toBe('dia');
    expect(getDayPhase(twelveMinutes)).toBe('noite');
    expect(getSecondsToNextDayPhase(0)).toBe(12 * 60);
  });

  it('passa pelas quatro fases da lua em 8 dias do jogo', () => {
    const phases = [0, 2, 4, 6].map((day) => getMoonPhase(day * BALANCE.dayLengthMs));
    expect(phases).toEqual(['nova', 'crescente', 'cheia', 'minguante']);
    expect(getMoonPhase(8 * BALANCE.dayLengthMs)).toBe('nova');
  });
});

describe('simulação', () => {
  it('não faz nada sem comitiva', () => {
    const state = createInitialState(START);
    const summary = advanceSimulation(state, 60, { startTimestamp: START });
    expect(summary.kills).toBe(0);
    expect(state.gold).toBe(0);
  });

  it('derrota visagens, rende Patacas e XP', () => {
    const state = createGameWith('saci');
    const summary = advanceSimulation(state, 60, {
      startTimestamp: START,
      random: createSeededRandom(7),
    });
    expect(summary.kills).toBeGreaterThan(10);
    expect(state.gold).toBe(summary.gold);
    expect(state.roster.saci.level).toBeGreaterThan(1);
    expect(state.stats.playTimeSeconds).toBeCloseTo(60, 6);
  });

  it('dá o mesmo resultado com a mesma semente', () => {
    const first = createGameWith('iara');
    const second = createGameWith('iara');
    advanceSimulation(first, 300, { startTimestamp: START, random: createSeededRandom(3) });
    advanceSimulation(second, 300, { startTimestamp: START, random: createSeededRandom(3) });
    expect(second).toEqual(first);
  });

  it('rende o mesmo em um passo longo ou em muitos passos curtos', () => {
    const inOneStep = createGameWith('curupira');
    const inManySteps = createGameWith('curupira');
    const random = createSeededRandom(5);
    advanceSimulation(inOneStep, 120, { startTimestamp: START, random: createSeededRandom(5) });

    for (let tick = 0; tick < 1200; tick += 1) {
      advanceSimulation(inManySteps, 0.1, { startTimestamp: START + tick * 100, random });
    }

    expect(Math.abs(inManySteps.stats.totalKills - inOneStep.stats.totalKills)).toBeLessThanOrEqual(
      1,
    );
    expect(inManySteps.stage).toBe(inOneStep.stage);
  });

  it('avança de estágio ao vencer o chefe com o avanço automático ligado', () => {
    const state = createGameWith('saci');
    const summary = advanceSimulation(state, 120, {
      startTimestamp: START,
      random: createSeededRandom(2),
    });
    expect(summary.bossesDefeated).toBeGreaterThan(0);
    expect(state.stage).toBe(1 + summary.stagesAdvanced);
    expect(state.maxStage).toBe(state.stage);
  });

  it('fica no estágio e junta visagens com o avanço automático desligado', () => {
    const state = createGameWith('saci');
    state.autoProgress = false;
    const summary = advanceSimulation(state, 120, {
      startTimestamp: START,
      random: createSeededRandom(2),
    });
    expect(state.stage).toBe(1);
    expect(summary.bossesDefeated).toBe(0);
    expect(state.killsInStage).toBe(10);
  });

  it('volta a juntar visagens quando o tempo do chefe acaba', () => {
    const state = createGameWith('saci');
    state.stage = 30;
    state.maxStage = 30;
    state.killsInStage = 10;
    state.combat = {
      enemyId: 'corpo-seco',
      enemyHp: 1e9,
      enemyMaxHp: 1e9,
      isBoss: true,
      bossTimeLeft: 30,
      attackProgress: {},
    };
    const summary = advanceSimulation(state, 31, {
      startTimestamp: START,
      random: createSeededRandom(2),
    });
    expect(summary.bossesFailed).toBe(1);
    expect(state.combat.isBoss).toBe(false);
    expect(state.stage).toBe(30);
  });

  it('só encontra Rastro do Boitatá à noite', () => {
    const byDay = createGameWith('saci');
    const byNight = createGameWith('saci');
    advanceSimulation(byDay, 600, { startTimestamp: START, random: createSeededRandom(9) });
    advanceSimulation(byNight, 600, { startTimestamp: NIGHT, random: createSeededRandom(9) });
    expect(byDay.trails.boitata ?? 0).toBe(0);
    expect(byNight.trails.boitata).toBeGreaterThan(0);
  });

  it('para de dar Rastro quando já tem o bastante', () => {
    const state = createGameWith('saci');
    advanceSimulation(state, 1800, { startTimestamp: START, random: createSeededRandom(4) });
    expect(state.trails.caipora).toBe(3);
  });
});

describe('sinergias e pactos', () => {
  it('acende a sinergia de mata com Curupira e Caipora', () => {
    expect(
      getActiveSynergies(['curupira', 'caipora'], 'dia').map((synergy) => synergy.origin),
    ).toEqual(['mata']);
    expect(getActiveSynergies(['curupira', 'saci'], 'dia')).toEqual([]);
  });

  it('fecha o pacto da Caipora quando tem Rastros e mel', () => {
    const state = createGameWith('saci');
    expect(sealPact(state, 'caipora', START)).toBe(false);

    state.trails.caipora = 3;
    state.inventory['mel-silvestre'] = 6;
    expect(getPactStatus(state, 'caipora', START).canSeal).toBe(true);
    expect(sealPact(state, 'caipora', START)).toBe(true);
    expect(state.party).toEqual(['saci', 'caipora']);
    expect(state.inventory['mel-silvestre']).toBe(1);
    expect(state.trails.caipora).toBeUndefined();
    expect(sealPact(state, 'caipora', START)).toBe(false);
  });

  it('só fecha o pacto do Boitatá à noite', () => {
    const state = createGameWith('saci');
    state.trails.boitata = 5;
    state.inventory = { 'brasa-viva': 3, 'cipo-trancado': 8 };
    expect(sealPact(state, 'boitata', START)).toBe(false);
    expect(sealPact(state, 'boitata', NIGHT)).toBe(true);
  });

  it('não fecha pacto com encantado inicial', () => {
    const state = createGameWith('saci');
    expect(sealPact(state, 'iara', START)).toBe(false);
  });
});

describe('progresso offline', () => {
  it('rende metade do tempo ausente', () => {
    const state = createGameWith('saci');
    const oneHour = 3600 * MS_PER_SECOND;
    const report = applyOfflineProgress(state, START + oneHour, createSeededRandom(1));
    expect(report?.secondsAway).toBe(3600);
    expect(report?.secondsSimulated).toBe(1800);
    expect(report?.summary.kills).toBeGreaterThan(100);
    expect(state.lastSaveTimestamp).toBe(START + oneHour);
  });

  it('respeita o teto de 8 horas', () => {
    const state = createGameWith('saci');
    const threeDays = 72 * 3600 * MS_PER_SECOND;
    const report = applyOfflineProgress(state, START + threeDays, createSeededRandom(1));
    expect(report?.secondsSimulated).toBe(4 * 3600);
  });

  it('não gera relatório sem comitiva', () => {
    const state = createInitialState(START);
    expect(applyOfflineProgress(state, START + 3600 * MS_PER_SECOND)).toBeNull();
  });
});
