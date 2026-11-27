/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/domain.test.ts
 * O que faz: testa o domínio sem navegador: fórmulas, relógio, combate,
 * ações da pessoa, pactos e progresso offline. Também confere que as funções
 * do domínio são puras: o estado de entrada é congelado antes de cada chamada,
 * então qualquer tentativa de alterá-lo derruba o teste.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE, MS_PER_SECOND } from '../src/data';
import {
  buyUpgrade,
  canChallengeBoss,
  challengeBoss,
  chooseStarter,
  goToStage,
  grantGold,
  setAutoProgress,
  setPartyLeader,
  togglePartyMember,
} from '../src/domain/actions';
import { getEnemy, getUpgrade } from '../src/domain/catalog';
import { getDayPhase, getMoonPhase, getSecondsToNextDayPhase } from '../src/domain/clock';
import {
  getEnemyMaxHp,
  getGoldReward,
  getRootsForRebrota,
  getUpgradeCost,
  getXpToNextLevel,
} from '../src/domain/formulas';
import { getActiveSynergies } from '../src/domain/modifiers';
import { applyOfflineProgress, mergeOfflineReports } from '../src/domain/offline';
import { getPactStatus, sealPact } from '../src/domain/pact';
import { advanceSimulation, dealDirectDamage } from '../src/domain/simulation';
import { createBossCombat, createInitialState, createOwnedEncantado } from '../src/domain/state';
import type { GameState } from '../src/domain/types';
import { createSeededRandom } from '../src/utils/random';

const START = 0; // começo de um dia do jogo
const NIGHT = BALANCE.dayLengthMs * 0.75;

// Congela o objeto inteiro. Alterar um objeto congelado lança erro nos testes (modo estrito).
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

// Jogo novo com um encantado inicial já escolhido, congelado para denunciar alteração
function createGameWith(encantadoId: string, changes: Partial<GameState> = {}): GameState {
  const fresh = createInitialState(START, createSeededRandom(1));
  const started = chooseStarter(fresh, encantadoId);

  if (started === null) {
    throw new Error(`"${encantadoId}" não é um encantado inicial.`);
  }

  return deepFreeze({ ...started, ...changes });
}

// Opções de simulação com sorteio repetível
// Roda "run" com outra chance de Rastro na clareira e devolve o valor de antes no fim
function withClearingTrailMultiplier<T>(multiplier: number, run: () => T): T {
  const balance = BALANCE as { clearingTrailMultiplier: number };
  const original = balance.clearingTrailMultiplier;
  balance.clearingTrailMultiplier = multiplier;

  try {
    return run();
  } finally {
    balance.clearingTrailMultiplier = original;
  }
}

function withSeed(seed: number, startTimestamp = START) {
  return { startTimestamp, random: createSeededRandom(seed) };
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
  it('não altera o estado recebido e devolve um estado novo', () => {
    const state = createGameWith('saci');
    const result = advanceSimulation(state, 60, withSeed(7));
    expect(result.state).not.toBe(state);
    expect(state.gold).toBe(0);
    expect(state.stats.totalKills).toBe(0);
    expect(result.state.gold).toBeGreaterThan(0);
  });

  it('devolve o mesmo estado quando não há o que simular', () => {
    const empty = deepFreeze(createInitialState(START, createSeededRandom(1)));
    expect(advanceSimulation(empty, 60, withSeed(1)).state).toBe(empty);

    const state = createGameWith('saci');
    expect(advanceSimulation(state, 0, withSeed(1)).state).toBe(state);
    expect(advanceSimulation(state, -5, withSeed(1)).state).toBe(state);
    expect(advanceSimulation(state, Number.NaN, withSeed(1)).state).toBe(state);
  });

  it('derrota visagens, rende Patacas e XP', () => {
    const { state, summary } = advanceSimulation(createGameWith('saci'), 60, withSeed(7));
    expect(summary.kills).toBeGreaterThan(10);
    expect(state.gold).toBe(summary.gold);
    expect(state.roster.saci?.level).toBeGreaterThan(1);
    expect(state.stats.playTimeSeconds).toBeCloseTo(60, 6);
  });

  it('dá o mesmo resultado com a mesma semente', () => {
    const first = advanceSimulation(createGameWith('iara'), 300, withSeed(3));
    const second = advanceSimulation(createGameWith('iara'), 300, withSeed(3));
    expect(second).toEqual(first);
  });

  it('rende o mesmo em um passo longo ou em muitos passos curtos', () => {
    const inOneStep = advanceSimulation(createGameWith('curupira'), 120, withSeed(5)).state;
    const random = createSeededRandom(5);
    let inManySteps = createGameWith('curupira');

    for (let tick = 0; tick < 1200; tick += 1) {
      const options = { startTimestamp: START + tick * 100, random };
      inManySteps = advanceSimulation(inManySteps, 0.1, options).state;
    }

    const killDifference = inManySteps.stats.totalKills - inOneStep.stats.totalKills;
    expect(Math.abs(killDifference)).toBeLessThanOrEqual(1);
    expect(inManySteps.stage).toBe(inOneStep.stage);
  });

  it('só devolve eventos quando eles são pedidos', () => {
    const state = createGameWith('saci');
    const silent = advanceSimulation(state, 10, withSeed(2));
    const withEvents = advanceSimulation(state, 10, { ...withSeed(2), collectEvents: true });
    expect(silent.events).toEqual([]);
    expect(withEvents.events.some((event) => event.type === 'hit')).toBe(true);
    expect(withEvents.events.some((event) => event.type === 'kill')).toBe(true);
  });

  it('avança de estágio ao vencer o chefe com o avanço automático ligado', () => {
    const { state, summary } = advanceSimulation(createGameWith('saci'), 120, withSeed(2));
    expect(summary.bossesDefeated).toBeGreaterThan(0);
    expect(state.stage).toBe(1 + summary.stagesAdvanced);
    expect(state.maxStage).toBe(state.stage);
  });

  it('fica no estágio e junta visagens com o avanço automático desligado', () => {
    const start = createGameWith('saci', { autoProgress: false });
    const { state, summary } = advanceSimulation(start, 120, withSeed(2));
    expect(state.stage).toBe(1);
    expect(summary.bossesDefeated).toBe(0);
    expect(state.killsInStage).toBe(10);
  });

  it('volta a juntar visagens quando o tempo do chefe acaba', () => {
    const start = createGameWith('saci', {
      stage: 30,
      maxStage: 30,
      killsInStage: 10,
      combat: createBossCombat(30, {}, 30),
    });
    const { state, summary } = advanceSimulation(start, 31, withSeed(2));
    expect(summary.bossesFailed).toBe(1);
    expect(state.combat.isBoss).toBe(false);
    expect(state.stage).toBe(30);
    expect(state.killsInStage).toBeLessThan(10);
    expect(state.stats.bossesFailed).toBe(1);
  });

  // As regras de hora e de teto valem com qualquer chance. Para ver a regra, a chance da
  // clareira volta a 100% só nestes testes.
  it('só encontra Rastro do Boitatá à noite', () => {
    withClearingTrailMultiplier(1, () => {
      const byDay = advanceSimulation(createGameWith('saci'), 600, withSeed(9, START)).state;
      const byNight = advanceSimulation(createGameWith('saci'), 600, withSeed(9, NIGHT)).state;
      expect(byDay.trails.boitata ?? 0).toBe(0);
      expect(byNight.trails.boitata).toBeGreaterThan(0);
    });
  });

  it('para de dar Rastro quando já tem o bastante', () => {
    withClearingTrailMultiplier(1, () => {
      const { state } = advanceSimulation(createGameWith('saci'), 1800, withSeed(4));
      expect(state.trails.caipora).toBe(3);
    });
  });

  it('a clareira dá só uma fração dos Rastros (a fonte principal são as pegadas)', () => {
    const full = withClearingTrailMultiplier(1, () =>
      advanceSimulation(createGameWith('saci'), 300, withSeed(4)),
    );
    const none = withClearingTrailMultiplier(0, () =>
      advanceSimulation(createGameWith('saci'), 300, withSeed(4)),
    );

    expect(BALANCE.clearingTrailMultiplier).toBeLessThan(1);
    expect(full.summary.trails.caipora ?? 0).toBeGreaterThan(0);
    expect(none.summary.trails).toEqual({});
  });
});

describe('dano direto', () => {
  it('tira vida sem alterar o estado recebido', () => {
    const state = createGameWith('saci');
    const damage = state.combat.enemyMaxHp / 4;
    const result = dealDirectDamage(state, damage, withSeed(1));
    expect(result.state.combat.enemyHp).toBeCloseTo(state.combat.enemyMaxHp * 0.75, 6);
    expect(state.combat.enemyHp).toBe(state.combat.enemyMaxHp);
  });

  it('entrega as recompensas normais ao derrotar', () => {
    const state = createGameWith('saci');
    const { state: after, summary } = dealDirectDamage(state, 1e9, withSeed(1));
    expect(summary.kills).toBe(1);
    expect(after.gold).toBeGreaterThan(0);
    expect(after.killsInStage).toBe(1);
    expect(after.combat.enemyHp).toBe(after.combat.enemyMaxHp);
  });

  it('ignora dano zero, negativo ou inválido', () => {
    const state = createGameWith('saci');
    expect(dealDirectDamage(state, 0, withSeed(1)).state).toBe(state);
    expect(dealDirectDamage(state, -3, withSeed(1)).state).toBe(state);
    expect(dealDirectDamage(state, Number.NaN, withSeed(1)).state).toBe(state);
  });
});

describe('ações da pessoa', () => {
  it('aceita um encantado inicial, e só um', () => {
    const fresh = deepFreeze(createInitialState(START, createSeededRandom(1)));
    expect(chooseStarter(fresh, 'caipora')).toBeNull();
    expect(chooseStarter(fresh, 'nao-existe')).toBeNull();

    const started = chooseStarter(fresh, 'saci');
    expect(started?.party).toEqual(['saci']);
    expect(fresh.party).toEqual([]);
    expect(started === null ? null : chooseStarter(started, 'iara')).toBeNull();
  });

  it('compra melhoria só com Patacas e respeita o nível máximo', () => {
    const poor = createGameWith('saci');
    expect(buyUpgrade(poor, 'reza-forte')).toBeNull();
    expect(buyUpgrade(poor, 'nao-existe')).toBeNull();

    const rich = createGameWith('saci', { gold: 100 });
    const bought = buyUpgrade(rich, 'reza-forte');
    expect(bought?.gold).toBe(90);
    expect(bought?.upgrades['reza-forte']).toBe(1);
    expect(rich.gold).toBe(100);

    const maxed = createGameWith('saci', { gold: 1e12, upgrades: { 'passo-ligeiro': 50 } });
    expect(buyUpgrade(maxed, 'passo-ligeiro')).toBeNull();
  });

  it('monta a comitiva sem deixar vazia nem passar do limite', () => {
    const alone = createGameWith('saci');
    expect(togglePartyMember(alone, 'saci')).toBeNull();
    expect(togglePartyMember(alone, 'iara')).toBeNull();

    const roster = { ...alone.roster, caipora: createOwnedEncantado('caipora') };
    const withCaipora = togglePartyMember(deepFreeze({ ...alone, roster }), 'caipora');
    expect(withCaipora?.party).toEqual(['saci', 'caipora']);
    expect(withCaipora?.combat.attackProgress.caipora).toBe(0);

    const backToOne = withCaipora === null ? null : togglePartyMember(withCaipora, 'caipora');
    expect(backToOne?.party).toEqual(['saci']);
    expect(backToOne?.combat.attackProgress.caipora).toBeUndefined();
  });

  it('põe um encantado da comitiva em primeiro, mantendo a ordem dos outros', () => {
    const alone = createGameWith('saci');
    const roster = {
      ...alone.roster,
      caipora: createOwnedEncantado('caipora'),
      iara: createOwnedEncantado('iara'),
    };
    const trio = deepFreeze({ ...alone, roster, party: ['saci', 'caipora', 'iara'] });
    const onExpedition = {
      ...trio,
      expedition: {
        mapId: 'beira-da-mata',
        encantadoId: 'saci',
        team: ['saci'],
        loot: [],
        trails: {},
        preparationId: null,
        activeSeconds: 0,
      },
    };

    expect(setPartyLeader(trio, 'iara')?.party).toEqual(['iara', 'saci', 'caipora']);
    expect(setPartyLeader(trio, 'saci')).toBeNull(); // já é o primeiro
    expect(setPartyLeader(trio, 'boitata')).toBeNull(); // não está na comitiva
    expect(setPartyLeader(onExpedition, 'iara')).toBeNull(); // quem saiu não troca no meio
  });

  it('desafia o chefe só com a contagem fechada', () => {
    const early = createGameWith('saci');
    expect(canChallengeBoss(early)).toBe(false);
    expect(challengeBoss(early)).toBeNull();

    const ready = createGameWith('saci', { killsInStage: 10 });
    const fighting = challengeBoss(ready);
    expect(fighting?.combat.isBoss).toBe(true);
    expect(fighting?.combat.bossTimeLeft).toBe(30);
    expect(fighting === null ? null : challengeBoss(fighting)).toBeNull();
  });

  it('só troca para estágio liberado', () => {
    const state = createGameWith('saci', { stage: 3, maxStage: 5, killsInStage: 7 });
    const random = createSeededRandom(1);
    expect(goToStage(state, 6, random)).toBeNull();
    expect(goToStage(state, 0, random)).toBeNull();
    expect(goToStage(state, 2.5, random)).toBeNull();

    const moved = goToStage(state, 5, random);
    expect(moved?.stage).toBe(5);
    expect(moved?.killsInStage).toBe(0);
    expect(moved?.combat.isBoss).toBe(false);
  });

  it('liga e desliga o avanço automático e soma Patacas de teste', () => {
    const state = createGameWith('saci');
    expect(setAutoProgress(state, false).autoProgress).toBe(false);
    expect(grantGold(state, 50)?.gold).toBe(50);
    expect(grantGold(state, 0)).toBeNull();
    expect(grantGold(state, -1)).toBeNull();
    expect(state.gold).toBe(0);
  });
});

describe('sinergias e pactos', () => {
  it('acende a sinergia de mata com Curupira e Caipora', () => {
    const origins = getActiveSynergies(['curupira', 'caipora'], 'dia').map((s) => s.origin);
    expect(origins).toEqual(['mata']);
    expect(getActiveSynergies(['curupira', 'saci'], 'dia')).toEqual([]);
  });

  it('fecha o pacto da Caipora quando tem Rastros e mel, sem alterar o estado recebido', () => {
    const missing = createGameWith('saci');
    expect(sealPact(missing, 'caipora', START)).toBeNull();

    const ready = createGameWith('saci', {
      trails: { caipora: 3 },
      inventory: { 'mel-silvestre': 6 },
    });
    expect(getPactStatus(ready, 'caipora', START).canSeal).toBe(true);

    const sealed = sealPact(ready, 'caipora', START);
    expect(sealed?.party).toEqual(['saci', 'caipora']);
    expect(sealed?.inventory['mel-silvestre']).toBe(1);
    expect(sealed?.trails.caipora).toBeUndefined();
    expect(ready.inventory['mel-silvestre']).toBe(6);
    expect(sealed === null ? null : sealPact(sealed, 'caipora', START)).toBeNull();
  });

  it('só fecha o pacto do Boitatá à noite', () => {
    const ready = createGameWith('saci', {
      trails: { boitata: 5 },
      inventory: { 'brasa-viva': 3, 'cipo-trancado': 8 },
    });
    expect(sealPact(ready, 'boitata', START)).toBeNull();
    expect(sealPact(ready, 'boitata', NIGHT)?.roster.boitata?.level).toBe(1);
  });

  it('não fecha pacto com encantado inicial nem com id que não existe', () => {
    const state = createGameWith('saci');
    expect(sealPact(state, 'iara', START)).toBeNull();
    expect(sealPact(state, 'nao-existe', START)).toBeNull();
  });
});

describe('progresso offline', () => {
  const oneHour = 3600 * MS_PER_SECOND;

  it('rende metade do tempo ausente, sem alterar o estado recebido', () => {
    const state = createGameWith('saci');
    const { state: after, report } = applyOfflineProgress(state, oneHour, createSeededRandom(1));
    expect(report?.secondsAway).toBe(3600);
    expect(report?.secondsSimulated).toBe(1800);
    expect(report?.summary.kills).toBeGreaterThan(100);
    expect(after.lastSaveTimestamp).toBe(oneHour);
    expect(state.lastSaveTimestamp).toBe(START);
    expect(state.gold).toBe(0);
  });

  it('respeita o teto de 8 horas', () => {
    const threeDays = 72 * oneHour;
    const { report } = applyOfflineProgress(
      createGameWith('saci'),
      threeDays,
      createSeededRandom(1),
    );
    expect(report?.secondsSimulated).toBe(4 * 3600);
  });

  it('não gera relatório sem comitiva nem com o relógio voltando', () => {
    const empty = deepFreeze(createInitialState(START, createSeededRandom(1)));
    const noParty = applyOfflineProgress(empty, oneHour, createSeededRandom(1));
    expect(noParty.report).toBeNull();
    expect(noParty.state.lastSaveTimestamp).toBe(oneHour);

    const backwards = applyOfflineProgress(createGameWith('saci'), -oneHour, createSeededRandom(1));
    expect(backwards.report).toBeNull();
    expect(backwards.state.lastSaveTimestamp).toBe(-oneHour);
    expect(backwards.state.gold).toBe(0);
  });

  it('soma dois relatórios', () => {
    const first = applyOfflineProgress(createGameWith('saci'), oneHour, createSeededRandom(1));
    const second = applyOfflineProgress(first.state, 2 * oneHour, createSeededRandom(2));

    if (first.report === null || second.report === null) {
      throw new Error('Os dois trechos deveriam gerar relatório.');
    }

    const merged = mergeOfflineReports(first.report, second.report);
    expect(merged.secondsAway).toBe(7200);
    expect(merged.summary.kills).toBe(first.report.summary.kills + second.report.summary.kills);
    expect(mergeOfflineReports(null, second.report)).toBe(second.report);
  });
});
