/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/store.test.ts
 * O que faz: testa a store como a interface vai usar: tick, ausência,
 * gravação no localStorage, exportar, importar e apagar tudo.
 * O localStorage e o relógio são simulados, porque o teste roda fora do navegador.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BALANCE, MS_PER_SECOND } from '../src/data';
import { SAVE_STORAGE_KEY } from '../src/store/saveManager';

const START = 1_800_000_000_000;
const ONE_HOUR_MS = 3600 * MS_PER_SECOND;

type StoreModule = typeof import('../src/store/useGameStore');

// localStorage simples em memória
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => void entries.delete(key),
    setItem: (key, value) => void entries.set(key, value),
  };
}

// Carrega a store do zero, como se a página tivesse acabado de abrir
async function openGame(): Promise<StoreModule['useGameStore']> {
  vi.resetModules();
  const module: StoreModule = await import('../src/store/useGameStore');
  return module.useGameStore;
}

// Avança o relógio e roda os ticks de 100 ms, como o laço do jogo faz
function play(useGameStore: StoreModule['useGameStore'], seconds: number): void {
  const tickCount = (seconds * MS_PER_SECOND) / BALANCE.tickIntervalMs;

  for (let tick = 0; tick < tickCount; tick += 1) {
    vi.advanceTimersByTime(BALANCE.tickIntervalMs);
    useGameStore.getState().tick(Date.now());
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('começo do jogo', () => {
  it('fica parado até a escolha do encantado inicial', async () => {
    const useGameStore = await openGame();
    play(useGameStore, 10);
    expect(useGameStore.getState().stats.totalKills).toBe(0);
    expect(useGameStore.getState().lastSaveTimestamp).toBe(START + 10 * MS_PER_SECOND);
  });

  it('aceita um encantado inicial, e só um', async () => {
    const useGameStore = await openGame();
    expect(useGameStore.getState().chooseStarter('caipora')).toBe(false);
    expect(useGameStore.getState().chooseStarter('saci')).toBe(true);
    expect(useGameStore.getState().chooseStarter('iara')).toBe(false);
    expect(useGameStore.getState().party).toEqual(['saci']);
  });
});

describe('tick', () => {
  it('avança o combate e entrega os eventos do último tick', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    play(useGameStore, 1);
    expect(useGameStore.getState().combatEvents.some((event) => event.type === 'hit')).toBe(true);

    play(useGameStore, 59);
    expect(useGameStore.getState().stats.totalKills).toBeGreaterThan(10);
    expect(useGameStore.getState().offlineReport).toBeNull();
  });

  it('rende o tempo inteiro quando a aba em segundo plano atrasa o tick', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    vi.advanceTimersByTime(60 * MS_PER_SECOND);
    useGameStore.getState().tick(Date.now());

    expect(useGameStore.getState().stats.playTimeSeconds).toBeCloseTo(60, 6);
    expect(useGameStore.getState().stats.totalKills).toBeGreaterThan(10);
    expect(useGameStore.getState().offlineReport).toBeNull();
    expect(useGameStore.getState().combatEvents).toEqual([]);
  });

  it('não rende nada se o relógio do aparelho voltar no tempo', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    useGameStore.getState().tick(START - ONE_HOUR_MS);
    expect(useGameStore.getState().stats.totalKills).toBe(0);
    expect(useGameStore.getState().lastSaveTimestamp).toBe(START - ONE_HOUR_MS);
  });

  it('mantém a referência do que não mudou', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    const upgradesBefore = useGameStore.getState().upgrades;
    play(useGameStore, 5);
    expect(useGameStore.getState().upgrades).toBe(upgradesBefore);
  });
});

describe('ações de jogo', () => {
  it('compra melhoria só com Patacas suficientes', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    expect(useGameStore.getState().buyUpgrade('reza-forte')).toBe(false);

    play(useGameStore, 60);
    const goldBefore = useGameStore.getState().gold;
    expect(useGameStore.getState().buyUpgrade('reza-forte')).toBe(true);
    expect(useGameStore.getState().gold).toBe(goldBefore - 10);
    expect(useGameStore.getState().upgrades['reza-forte']).toBe(1);
    expect(useGameStore.getState().buyUpgrade('nao-existe')).toBe(false);
  });

  it('desafia o chefe na mão e volta para estágios liberados', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    useGameStore.getState().setAutoProgress(false);
    expect(useGameStore.getState().challengeBoss()).toBe(false);

    play(useGameStore, 60);
    expect(useGameStore.getState().challengeBoss()).toBe(true);
    expect(useGameStore.getState().combat.isBoss).toBe(true);

    play(useGameStore, 30);
    expect(useGameStore.getState().maxStage).toBe(2);
    expect(useGameStore.getState().stage).toBe(1);
    expect(useGameStore.getState().goToStage(2)).toBe(true);
    expect(useGameStore.getState().goToStage(3)).toBe(false);
  });

  it('não deixa a comitiva vazia', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    expect(useGameStore.getState().togglePartyMember('saci')).toBe(false);
    expect(useGameStore.getState().togglePartyMember('iara')).toBe(false);
  });
});

describe('ausência', () => {
  it('gera o relatório de volta com metade do tempo', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    vi.advanceTimersByTime(ONE_HOUR_MS);
    useGameStore.getState().tick(Date.now());

    const report = useGameStore.getState().offlineReport;
    expect(report?.secondsAway).toBe(3600);
    expect(report?.secondsSimulated).toBe(1800);
    expect(report?.summary.gold).toBe(useGameStore.getState().gold);

    useGameStore.getState().dismissOfflineReport();
    expect(useGameStore.getState().offlineReport).toBeNull();
  });
});

describe('salvamento', () => {
  it('grava no localStorage no máximo uma vez a cada intervalo', async () => {
    const useGameStore = await openGame();
    const setItem = vi.spyOn(localStorage, 'setItem');
    useGameStore.getState().chooseStarter('saci');
    play(useGameStore, 12);
    expect(setItem.mock.calls.length).toBeLessThanOrEqual(3);
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
  });

  it('recupera o jogo ao reabrir a página e rende a ausência', async () => {
    const firstSession = await openGame();
    firstSession.getState().chooseStarter('curupira');
    play(firstSession, 60);
    firstSession.getState().buyUpgrade('reza-forte');
    firstSession.getState().saveNow();
    const saved = firstSession.getState();

    vi.advanceTimersByTime(ONE_HOUR_MS);
    const secondSession = await openGame();
    expect(secondSession.getState().gold).toBe(saved.gold);
    expect(secondSession.getState().roster).toEqual(saved.roster);
    expect(secondSession.getState().upgrades).toEqual(saved.upgrades);

    secondSession.getState().tick(Date.now());
    expect(secondSession.getState().offlineReport?.secondsAway).toBe(3600);
    expect(secondSession.getState().gold).toBeGreaterThan(saved.gold);
  });

  it('exporta e importa o jogo sem render ausência', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('iara');
    play(useGameStore, 60);
    const code = useGameStore.getState().exportSave();
    const exported = useGameStore.getState();

    useGameStore.getState().hardReset();
    expect(useGameStore.getState().party).toEqual([]);
    expect(useGameStore.getState().gold).toBe(0);

    vi.advanceTimersByTime(ONE_HOUR_MS);
    expect(useGameStore.getState().importSave(code)).toEqual({ ok: true });
    expect(useGameStore.getState().gold).toBe(exported.gold);
    expect(useGameStore.getState().roster).toEqual(exported.roster);
    expect(useGameStore.getState().lastSaveTimestamp).toBe(Date.now());
    expect(useGameStore.getState().offlineReport).toBeNull();
  });

  it('recusa código inválido sem mexer no jogo', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    play(useGameStore, 30);
    const goldBefore = useGameStore.getState().gold;

    expect(useGameStore.getState().importSave('isto não é um salvamento').ok).toBe(false);
    expect(useGameStore.getState().importSave(btoa('{"game":"outro","version":1}')).ok).toBe(false);
    expect(useGameStore.getState().importSave(btoa('{"game":"encantados","version":99}')).ok).toBe(
      false,
    );
    expect(useGameStore.getState().gold).toBe(goldBefore);
  });

  it('conserta um salvamento adulterado ao importar', async () => {
    const useGameStore = await openGame();
    const tampered = {
      game: 'encantados',
      version: 1,
      state: {
        gold: -50,
        stage: 'dez',
        party: ['saci', 'saci', 'dragao'],
        roster: { saci: { level: 0 }, dragao: { level: 99 } },
        upgrades: { 'passo-ligeiro': 9999, inventado: 3 },
        inventory: { 'mel-silvestre': 2.7, ouro: 1 },
      },
    };

    expect(useGameStore.getState().importSave(btoa(JSON.stringify(tampered)))).toEqual({
      ok: true,
    });
    const state = useGameStore.getState();
    expect(state.gold).toBe(0);
    expect(state.stage).toBe(1);
    expect(state.party).toEqual(['saci']);
    expect(Object.keys(state.roster)).toEqual(['saci']);
    expect(state.roster.saci?.level).toBe(1);
    expect(state.upgrades).toEqual({ 'passo-ligeiro': 50 });
    expect(state.inventory).toEqual({ 'mel-silvestre': 2 });
    expect(state.combat.enemyHp).toBeGreaterThan(0);
  });

  it('apaga tudo e grava o jogo novo na hora', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    play(useGameStore, 30);
    useGameStore.getState().hardReset();

    const reopened = await openGame();
    expect(reopened.getState().party).toEqual([]);
    expect(reopened.getState().stats.totalKills).toBe(0);
  });

  it('guarda uma cópia do salvamento ilegível e começa do zero', async () => {
    localStorage.setItem(SAVE_STORAGE_KEY, '{quebrado');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const useGameStore = await openGame();

    expect(useGameStore.getState().party).toEqual([]);
    expect(localStorage.getItem(`${SAVE_STORAGE_KEY}-corrompido`)).toBe('{quebrado');
    expect(warn).toHaveBeenCalled();
  });
});

describe('entrada antes da atualização', () => {
  it('simula até o instante da ação antes de aplicar', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');

    // Um minuto sem nenhum tick, como numa aba que travou
    vi.advanceTimersByTime(60 * MS_PER_SECOND);
    expect(useGameStore.getState().buyUpgrade('reza-forte')).toBe(true);
    expect(useGameStore.getState().stats.playTimeSeconds).toBeCloseTo(60, 6);
    expect(useGameStore.getState().lastSaveTimestamp).toBe(Date.now());
  });
});

describe('duas abas', () => {
  it('para de simular e de gravar quando outra aba assume o jogo', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    play(useGameStore, 60);
    useGameStore.getState().saveNow();
    const savedText = localStorage.getItem(SAVE_STORAGE_KEY);
    const killsBefore = useGameStore.getState().stats.totalKills;

    useGameStore.getState().yieldToAnotherTab();
    play(useGameStore, 30);
    useGameStore.getState().saveNow();

    expect(useGameStore.getState().isOpenInAnotherTab).toBe(true);
    expect(useGameStore.getState().stats.totalKills).toBe(killsBefore);
    expect(useGameStore.getState().buyUpgrade('reza-forte')).toBe(false);
    expect(useGameStore.getState().importSave('qualquer').ok).toBe(false);
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(savedText);
  });

  it('a aba nova continua de onde a antiga parou, sem perder o intervalo', async () => {
    const oldTab = await openGame();
    oldTab.getState().chooseStarter('saci');
    play(oldTab, 60);
    oldTab.getState().saveNow();

    // A aba antiga joga mais 3 segundos que não chegam a ser gravados
    play(oldTab, 3);
    const newTab = await openGame();
    newTab.getState().tick(Date.now());
    expect(newTab.getState().stats.playTimeSeconds).toBeCloseTo(63, 6);
  });

  it('avisa quando outra aba escreve a própria marca', async () => {
    vi.stubGlobal('window', new EventTarget());
    const { claimActiveTab } = await import('../src/store/tabGuard');
    const onTakenOver = vi.fn();
    const stopWatching = claimActiveTab(onTakenOver);
    const ownTabId = localStorage.getItem('encantados-aba-ativa');
    const notify = (key: string, newValue: string | null) =>
      window.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }));

    notify('encantados-aba-ativa', ownTabId);
    notify(SAVE_STORAGE_KEY, 'qualquer coisa');
    expect(onTakenOver).not.toHaveBeenCalled();

    notify('encantados-aba-ativa', 'marca-de-outra-aba');
    expect(onTakenOver).toHaveBeenCalledTimes(1);

    stopWatching();
    notify('encantados-aba-ativa', 'mais-uma-aba');
    expect(onTakenOver).toHaveBeenCalledTimes(1);
  });
});

describe('ações de teste e contador de ticks', () => {
  it('conta os ticks e para de contar quando outra aba assume', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    const countBefore = useGameStore.getState().tickCount;
    play(useGameStore, 2);
    expect(useGameStore.getState().tickCount).toBe(countBefore + 20);

    useGameStore.getState().yieldToAnotherTab();
    play(useGameStore, 2);
    expect(useGameStore.getState().tickCount).toBe(countBefore + 20);
  });

  it('tira vida com o golpe manual e entrega as recompensas ao derrotar', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    const maxHp = useGameStore.getState().combat.enemyMaxHp;

    useGameStore.getState().debugHitEnemy(0.25);
    expect(useGameStore.getState().combat.enemyHp).toBeCloseTo(maxHp * 0.75, 6);

    useGameStore.getState().debugHitEnemy(1);
    expect(useGameStore.getState().stats.totalKills).toBe(1);
    expect(useGameStore.getState().gold).toBeGreaterThan(0);
    expect(useGameStore.getState().combat.enemyHp).toBe(useGameStore.getState().combat.enemyMaxHp);
  });

  it('soma Patacas de teste sem mexer na estatística', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().debugGrantGold(100);
    useGameStore.getState().debugGrantGold(-5);
    expect(useGameStore.getState().gold).toBe(100);
    expect(useGameStore.getState().stats.totalGoldEarned).toBe(0);
  });
});

describe('amuletos e migração do salvamento', () => {
  // Estado como a versão 1 gravava: sem nenhum campo de amuleto
  const versionOneState = {
    version: 1,
    gold: 777,
    stage: 4,
    maxStage: 6,
    killsInStage: 3,
    autoProgress: true,
    party: ['saci'],
    roster: { saci: { id: 'saci', level: 9, xp: 12, bond: 0 } },
    trails: { caipora: 2 },
    inventory: { 'mel-silvestre': 4 },
    upgrades: { 'reza-forte': 3 },
    roots: 0,
    combat: {
      enemyId: 'visagem-da-neblina',
      enemyHp: 5,
      enemyMaxHp: 17,
      isBoss: false,
      bossTimeLeft: 0,
      attackProgress: { saci: 0.5 },
    },
    lastSaveTimestamp: START,
    stats: { totalKills: 120, totalGoldEarned: 900, bossesDefeated: 5, playTimeSeconds: 600 },
  };

  it('abre um salvamento da versão 1 sem perder nada e já na versão atual', async () => {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: versionOneState, version: 1 }));
    const useGameStore = await openGame();
    const state = useGameStore.getState();

    expect(state.gold).toBe(777);
    expect(state.stage).toBe(4);
    expect(state.maxStage).toBe(6);
    expect(state.roster.saci?.level).toBe(9);
    expect(state.upgrades).toEqual({ 'reza-forte': 3 });
    expect(state.stats.totalKills).toBe(120);
    expect(state.combat.enemyHp).toBe(5);

    expect(state.version).toBe(BALANCE.saveVersion);
    expect(state.edition).toBe(1);
    expect(state.juazeiro).toEqual({});
    expect(state.amulets).toEqual({});
    expect(state.equipped).toEqual({});
    expect(state.shavings).toBe(0);
    expect(state.autoSalvage).toBeNull();
    expect(state.nextAmuletNumber).toBe(1);
    expect(state.stats.amuletsFound).toBe(0);

    // O jogo migrado roda, ganha amuleto e é gravado de volta já no formato novo
    play(useGameStore, 1);
    useGameStore.getState().debugGrantAmulet();
    useGameStore.getState().saveNow();
    const saved = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) ?? '{}');
    expect(saved.version).toBe(BALANCE.saveVersion);
    // O segundo de clareira pode sortear outro amuleto antes do que o teste deu
    expect(Object.keys(saved.state.amulets)).toContain('amuleto-1');
  });

  it('importa um código exportado na versão 1', async () => {
    const useGameStore = await openGame();
    const oldExport = { game: 'encantados', version: 1, exportedAt: START, state: versionOneState };

    expect(useGameStore.getState().importSave(btoa(JSON.stringify(oldExport)))).toEqual({
      ok: true,
    });
    expect(useGameStore.getState().gold).toBe(777);
    expect(useGameStore.getState().amulets).toEqual({});
    expect(useGameStore.getState().version).toBe(BALANCE.saveVersion);
  });

  it('guarda os amuletos no salvamento e recupera ao reabrir', async () => {
    const firstSession = await openGame();
    firstSession.getState().chooseStarter('saci');
    firstSession.getState().debugGrantAmulet();
    firstSession.getState().debugGrantAmulet();
    firstSession.getState().equipAmulet('saci', 'amuleto-1');
    firstSession.getState().setAutoSalvage('comum');
    firstSession.getState().saveNow();
    const saved = firstSession.getState();

    const secondSession = await openGame();
    expect(secondSession.getState().amulets).toEqual(saved.amulets);
    expect(secondSession.getState().equipped).toEqual({ saci: 'amuleto-1' });
    expect(secondSession.getState().autoSalvage).toBe('comum');
    expect(secondSession.getState().nextAmuletNumber).toBe(3);
  });

  it('conserta amuletos adulterados ao importar', async () => {
    const useGameStore = await openGame();
    const goodAmulet = {
      baseId: 'figa',
      rarity: 'raro',
      foundAtStage: 3,
      level: 999,
      bonuses: [
        { stat: 'damage', value: 0.2 },
        { stat: 'inventado', value: 5 },
        { stat: 'gold', value: -1 },
      ],
    };
    const tampered = {
      game: 'encantados',
      version: 2,
      state: {
        party: ['saci'],
        roster: { saci: { level: 1 } },
        shavings: -40,
        autoSalvage: 'mitico',
        nextAmuletNumber: 1,
        amulets: {
          'amuleto-7': goodAmulet,
          'amuleto-8': { ...goodAmulet, baseId: 'tipo-que-nao-existe' },
          'amuleto-9': { ...goodAmulet, rarity: 'mitico' },
          'amuleto-10': { ...goodAmulet, bonuses: [] },
        },
        equipped: { saci: 'amuleto-7', iara: 'amuleto-7', curupira: 'amuleto-404' },
      },
    };

    expect(useGameStore.getState().importSave(btoa(JSON.stringify(tampered)))).toEqual({
      ok: true,
    });
    const state = useGameStore.getState();
    expect(Object.keys(state.amulets)).toEqual(['amuleto-7']);
    expect(state.amulets['amuleto-7']?.level).toBe(10);
    expect(state.amulets['amuleto-7']?.bonuses).toEqual([{ stat: 'damage', value: 0.2 }]);
    expect(state.equipped).toEqual({ saci: 'amuleto-7' });
    expect(state.shavings).toBe(0);
    expect(state.autoSalvage).toBeNull();
    expect(state.nextAmuletNumber).toBe(8);
  });

  it('veste, entalha e desmancha pelas ações da store', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    useGameStore.getState().debugGrantAmulet();
    useGameStore.getState().debugGrantAmulet();

    expect(useGameStore.getState().equipAmulet('saci', 'amuleto-1')).toBe(true);
    expect(useGameStore.getState().equipAmulet('saci', 'amuleto-1')).toBe(false);
    expect(useGameStore.getState().salvageAmulet('amuleto-1')).toBe(false);
    expect(useGameStore.getState().carveAmulet('amuleto-1')).toBe(false);

    expect(useGameStore.getState().salvageAmulet('amuleto-2')).toBe(true);
    expect(useGameStore.getState().shavings).toBeGreaterThan(0);
    expect(useGameStore.getState().unequipAmulet('saci')).toBe(true);
    expect(useGameStore.getState().salvageBagUpTo('lendario')).toBe(true);
    expect(useGameStore.getState().amulets).toEqual({});
  });

  it('entrega amuletos pelo tick e conta na volta de uma ausência', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    vi.advanceTimersByTime(8 * ONE_HOUR_MS);
    useGameStore.getState().tick(Date.now());

    const report = useGameStore.getState().offlineReport;
    expect(report?.summary.amuletsFound).toBeGreaterThan(0);
    expect(useGameStore.getState().stats.amuletsFound).toBe(report?.summary.amuletsFound);
  });
});

describe('Rebrota e salvamento da versão 3', () => {
  // Estado como a versão 2 gravava: com amuletos e sem nada da Rebrota
  const versionTwoState = {
    version: 2,
    gold: 900,
    stage: 37,
    maxStage: 38,
    killsInStage: 0,
    autoProgress: true,
    party: ['saci'],
    roster: { saci: { id: 'saci', level: 25, xp: 0, bond: 0 } },
    trails: {},
    inventory: {},
    upgrades: { 'reza-forte': 10 },
    roots: 0,
    amulets: {},
    equipped: {},
    shavings: 7,
    autoSalvage: 'comum',
    nextAmuletNumber: 4,
    lastSaveTimestamp: START,
    stats: {
      totalKills: 800,
      totalGoldEarned: 9000,
      bossesDefeated: 37,
      playTimeSeconds: 1500,
      amuletsFound: 3,
    },
  };

  it('abre um salvamento da versão 2 sem perder nada', async () => {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: versionTwoState, version: 2 }));
    const useGameStore = await openGame();
    const state = useGameStore.getState();

    expect(state.version).toBe(BALANCE.saveVersion);
    expect(state.maxStage).toBe(38);
    expect(state.shavings).toBe(7);
    expect(state.autoSalvage).toBe('comum');
    expect(state.edition).toBe(1);
    expect(state.recordStage).toBe(0);
    expect(state.juazeiro).toEqual({});
    expect(state.autoBuy).toBe(false);
    expect(state.editionSeconds).toBe(1500);
    expect(state.stats.bossesFailed).toBe(0);
  });

  it('rebrota pela store, com cerimônia e linha no registro', async () => {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: versionTwoState, version: 2 }));
    const useGameStore = await openGame();

    expect(useGameStore.getState().rebrota()).toBe(true);
    const state = useGameStore.getState();
    expect(state.edition).toBe(2);
    expect(state.stage).toBe(1);
    expect(state.roots).toBe(7);
    expect(state.recordStage).toBe(38);
    expect(state.rebrotaCeremony).toEqual({ edition: 2, roots: 7 });
    expect(state.combatEvents).toEqual([{ type: 'rebrota', edition: 2, roots: 7 }]);

    useGameStore.getState().dismissRebrotaCeremony();
    expect(useGameStore.getState().rebrotaCeremony).toBeNull();
    expect(useGameStore.getState().rebrota()).toBe(false);
  });

  it('compra nós, liga a compra automática e guarda tudo ao reabrir', async () => {
    const firstSession = await openGame();
    firstSession.getState().chooseStarter('saci');
    firstSession.getState().debugGrantRoots(12);
    expect(firstSession.getState().buyJuazeiroNode('mao-ligeira')).toBe(true);
    expect(firstSession.getState().buyJuazeiroNode('cerne-duro')).toBe(true);
    expect(firstSession.getState().buyJuazeiroNode('noite-comprida')).toBe(false);
    firstSession.getState().setAutoBuy(false);
    firstSession.getState().saveNow();

    const secondSession = await openGame();
    expect(secondSession.getState().juazeiro).toEqual({ 'mao-ligeira': 1, 'cerne-duro': 1 });
    expect(secondSession.getState().roots).toBe(12);
    expect(secondSession.getState().autoBuy).toBe(false);
  });

  it('conserta um juazeiro adulterado ao importar', async () => {
    const useGameStore = await openGame();
    const tampered = (juazeiro: unknown, roots: unknown) =>
      btoa(
        JSON.stringify({
          game: 'encantados',
          version: 3,
          state: { party: ['saci'], roster: { saci: { level: 1 } }, roots, juazeiro, edition: -4 },
        }),
      );

    useGameStore.getState().importSave(tampered({ 'cerne-duro': 99, inventado: 3 }, 100));
    expect(useGameStore.getState().juazeiro).toEqual({ 'cerne-duro': 10 });
    expect(useGameStore.getState().edition).toBe(1);

    useGameStore.getState().importSave(tampered({ 'mao-ligeira': 1 }, 2));
    expect(useGameStore.getState().juazeiro).toEqual({});
    expect(useGameStore.getState().roots).toBe(2);
  });
});

describe('expedições e salvamento da versão 5', () => {
  // Estado como a versão 4 gravava: com a posição no mundo aberto e sem expedição
  const versionFourState = {
    version: 4,
    gold: 321,
    stage: 12,
    maxStage: 12,
    killsInStage: 0,
    autoProgress: true,
    party: ['iara'],
    roster: { iara: { id: 'iara', level: 8, xp: 0, bond: 0 } },
    trails: {},
    inventory: {},
    upgrades: {},
    roots: 0,
    juazeiro: {},
    edition: 1,
    recordStage: 0,
    editionSeconds: 600,
    autoBuy: false,
    amulets: {},
    equipped: {},
    shavings: 0,
    autoSalvage: null,
    nextAmuletNumber: 1,
    world: { mapId: 'beira-da-mata', x: 7.5, y: 3.5 },
    lastSaveTimestamp: START,
    stats: {
      totalKills: 120,
      totalGoldEarned: 900,
      bossesDefeated: 1,
      playTimeSeconds: 600,
      amuletsFound: 0,
      bossesFailed: 0,
    },
  };

  // Abre o jogo com o Saci escolhido e parte em expedição
  async function openExpedition(): Promise<StoreModule['useGameStore']> {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    expect(useGameStore.getState().startExpedition('beira-da-mata')).toBe(true);
    return useGameStore;
  }

  // Roda ticks de 0,1 s, como o laço faz
  function runTicks(useGameStore: StoreModule['useGameStore'], count: number): void {
    for (let tick = 0; tick < count; tick += 1) {
      vi.advanceTimersByTime(100);
      useGameStore.getState().tick(Date.now());
    }
  }

  it('abre um salvamento da versão 4 na clareira, sem perder nada', async () => {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: versionFourState, version: 4 }));
    const useGameStore = await openGame();
    const state = useGameStore.getState();

    expect(state.version).toBe(BALANCE.saveVersion);
    expect(state.expedition).toBeNull();
    expect('world' in state).toBe(false);
    expect(state.gold).toBe(321);
    expect(state.stage).toBe(12);
    expect(state.party).toEqual(['iara']);
  });

  it('parte com o primeiro da comitiva, com a cena montada e a vida cheia', async () => {
    const useGameStore = await openExpedition();
    const state = useGameStore.getState();

    expect(state.expedition).toEqual({
      mapId: 'beira-da-mata',
      encantadoId: 'saci',
      team: ['saci'],
      loot: [],
      trails: {},
      preparationId: null,
      activeSeconds: 0,
    });
    expect(state.expeditionScene?.trailTargets).toEqual([{ encantadoId: 'caipora', remaining: 3 }]);
    expect(state.expeditionScene?.playerHp).toBe(BALANCE.playerBaseHp);
    expect(state.startExpedition('brejo-escuro')).toBe(false);
  });

  it('parte com a comitiva inteira e troca quem está em campo no próximo tick', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    const { roster } = useGameStore.getState();
    useGameStore.setState({
      roster: { ...roster, iara: { id: 'iara', level: 1, xp: 0, bond: 0 } },
      party: ['saci', 'iara'],
    });
    expect(useGameStore.getState().startExpedition('beira-da-mata')).toBe(true);

    const started = useGameStore.getState();
    expect(started.expedition?.team).toEqual(['saci', 'iara']);
    expect(started.expeditionScene?.team.map((member) => member.encantadoId)).toEqual([
      'saci',
      'iara',
    ]);

    useGameStore.getState().swapFighter(1);
    expect(useGameStore.getState().swapPending).toBe(1);
    runTicks(useGameStore, 1);
    expect(useGameStore.getState().expeditionScene?.activeIndex).toBe(1);
    expect(useGameStore.getState().swapPending).toBeNull();

    // Pausada, o pedido de troca não vale
    useGameStore.getState().pauseExpedition();
    useGameStore.getState().swapFighter(0);
    expect(useGameStore.getState().swapPending).toBeNull();
  });

  it('parte com um preparo: paga as Oferendas e a cena já começa com o efeito', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    useGameStore.setState({ inventory: { 'cipo-trancado': 4 } });

    expect(useGameStore.getState().startExpedition('beira-da-mata', 'favo-no-toco')).toBe(false);
    expect(useGameStore.getState().startExpedition('beira-da-mata', 'trilha-de-cipo')).toBe(true);

    const state = useGameStore.getState();
    expect(state.inventory['cipo-trancado']).toBe(1);
    expect(state.expedition?.preparationId).toBe('trilha-de-cipo');
    expect(state.expeditionScene?.modifiers.footprintRate).toBe(2);
  });

  it('anda na expedição, a clareira fica parada e o tempo andado fica salvo', async () => {
    const useGameStore = await openExpedition();
    const before = useGameStore.getState();
    const startX = before.expeditionScene?.playerX ?? 0;

    useGameStore.getState().setMoveInput({ moveX: 1, moveY: 0 });
    runTicks(useGameStore, 100);

    const state = useGameStore.getState();
    expect(state.expeditionScene?.playerX).toBeGreaterThan(startX);
    // A clareira não andou: o combate de estágios está igual ao da partida
    expect(state.combat).toEqual(before.combat);
    expect(state.killsInStage).toBe(before.killsInStage);
    expect(state.expedition?.activeSeconds).toBeCloseTo(
      state.expeditionScene?.elapsedSeconds ?? -1,
      6,
    );
    expect(state.lastSaveTimestamp).toBe(Date.now());
  });

  it('na volta, a garantia paga pelo menos o que a clareira renderia no mesmo tempo', async () => {
    const useGameStore = await openExpedition();
    // Parada por 30 segundos a personagem poderia cair antes da hora: fica no Redemoinho
    const scene = useGameStore.getState().expeditionScene;
    useGameStore.setState({ expeditionScene: scene && { ...scene, invulnerableSeconds: 1e9 } });
    runTicks(useGameStore, 300); // 30 segundos de expedição, sem andar
    expect(useGameStore.getState().expedition).not.toBeNull();

    const goldBefore = useGameStore.getState().gold;
    useGameStore.getState().leaveExpedition();
    const report = useGameStore.getState().expeditionReport;

    expect(report?.clearingGold).toBeGreaterThan(0);
    expect(report?.summary.gold).toBeGreaterThanOrEqual((report?.clearingGold ?? 0) - 1e-9);
    expect(useGameStore.getState().gold).toBeCloseTo(goldBefore + (report?.summary.gold ?? 0), 6);
  });

  it('entrega a bolsa ao voltar e abre o relatório', async () => {
    const useGameStore = await openExpedition();
    useGameStore.setState({
      expedition: {
        mapId: 'beira-da-mata',
        encantadoId: 'saci',
        team: ['saci'],
        loot: [{ enemyId: 'visagem-da-neblina', level: 1, count: 5 }],
        trails: {},
        preparationId: null,
        activeSeconds: 0,
      },
    });
    const goldBefore = useGameStore.getState().gold;

    expect(useGameStore.getState().leaveExpedition()).toBe(true);

    const state = useGameStore.getState();
    expect(state.expedition).toBeNull();
    expect(state.expeditionScene).toBeNull();
    expect(state.expeditionReport?.outcome).toBe('voltou');
    expect(state.expeditionReport?.kills).toBe(5);
    expect(state.gold).toBeGreaterThan(goldBefore);
    expect(state.leaveExpedition()).toBe(false);
  });

  it('pausa a expedição numa ausência com a cena na memória, e a ausência não rende', async () => {
    const useGameStore = await openExpedition();
    runTicks(useGameStore, 20);
    const sceneBefore = useGameStore.getState().expeditionScene;
    vi.advanceTimersByTime(ONE_HOUR_MS);
    useGameStore.getState().tick(Date.now());

    const state = useGameStore.getState();
    expect(state.expedition?.mapId).toBe('beira-da-mata');
    expect(state.isExpeditionPaused).toBe(true);
    expect(state.expeditionScene?.elapsedSeconds).toBe(sceneBefore?.elapsedSeconds);
    expect(state.expeditionReport).toBeNull();
    // A comitiva está fora: a clareira não rende a ausência
    expect(state.offlineReport).toBeNull();
    expect(state.lastSaveTimestamp).toBe(Date.now());
  });

  it('pausada, a cena não anda, e ao continuar só conta o tempo depois da volta', async () => {
    const useGameStore = await openExpedition();
    runTicks(useGameStore, 10);
    useGameStore.getState().setMoveInput({ moveX: 1, moveY: 0 });
    useGameStore.getState().pauseExpedition();
    const paused = useGameStore.getState();
    const elapsedAtPause = paused.expeditionScene?.elapsedSeconds ?? 0;
    const killsAtPause = paused.stats.totalKills;

    expect(paused.isExpeditionPaused).toBe(true);
    expect(paused.moveInput).toEqual({ moveX: 0, moveY: 0 });

    // A direção e o golpe especial pedidos durante a pausa são ignorados
    useGameStore.getState().setMoveInput({ moveX: 0, moveY: 1 });
    useGameStore.getState().triggerSpecial();
    runTicks(useGameStore, 300);

    const stillPaused = useGameStore.getState();
    expect(stillPaused.expeditionScene?.elapsedSeconds).toBe(elapsedAtPause);
    expect(stillPaused.moveInput).toEqual({ moveX: 0, moveY: 0 });
    expect(stillPaused.isSpecialPending).toBe(false);
    expect(stillPaused.stats.totalKills).toBe(killsAtPause); // pausada, a clareira também para

    useGameStore.getState().resumeExpedition();
    runTicks(useGameStore, 10);
    const resumed = useGameStore.getState();
    expect(resumed.isExpeditionPaused).toBe(false);
    expect(resumed.expeditionScene?.elapsedSeconds ?? 0).toBeCloseTo(elapsedAtPause + 1, 6);
  });

  it('pausar e continuar sem expedição não fazem nada', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().chooseStarter('saci');
    useGameStore.getState().pauseExpedition();
    expect(useGameStore.getState().isExpeditionPaused).toBe(false);

    useGameStore.getState().resumeExpedition();
    expect(useGameStore.getState().isExpeditionPaused).toBe(false);
  });

  it('voltar com a expedição pausada entrega a bolsa e tira a pausa', async () => {
    const useGameStore = await openExpedition();
    runTicks(useGameStore, 10);
    useGameStore.getState().pauseExpedition();

    expect(useGameStore.getState().leaveExpedition()).toBe(true);
    expect(useGameStore.getState().expedition).toBeNull();
    expect(useGameStore.getState().isExpeditionPaused).toBe(false);
    expect(useGameStore.getState().expeditionReport?.outcome).toBe('voltou');
  });

  it('entrega a bolsa ao abrir um salvamento com expedição em andamento', async () => {
    const saved = {
      ...versionFourState,
      version: 5,
      world: undefined,
      expedition: {
        mapId: 'brejo-escuro',
        encantadoId: 'iara',
        loot: [
          { enemyId: 'assombro-do-brejo', level: 4, count: 3 },
          { enemyId: 'nada', level: 1, count: 2 },
        ],
      },
    };
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: saved, version: 5 }));
    const useGameStore = await openGame();

    expect(useGameStore.getState().expedition?.loot).toHaveLength(1);
    // Salvamento de antes do revezamento: sai só quem entrou em campo
    expect(useGameStore.getState().expedition?.team).toEqual(['iara']);
    // Salvamento da versão 5 de antes das pegadas e dos preparos: sem "trails" nem
    // "preparationId", abre com a bolsa sem Rastros e sem preparo
    expect(useGameStore.getState().expedition?.trails).toEqual({});
    expect(useGameStore.getState().expedition?.preparationId).toBeNull();
    runTicks(useGameStore, 1);
    expect(useGameStore.getState().expedition).toBeNull();
    expect(useGameStore.getState().expeditionReport?.kills).toBe(3);
  });

  it('recarga no meio: garantia pelo tempo salvo, e a ausência rende na clareira', async () => {
    const saved = {
      ...versionFourState,
      version: 5,
      world: undefined,
      lastSaveTimestamp: Date.now() - ONE_HOUR_MS,
      expedition: {
        mapId: 'beira-da-mata',
        encantadoId: 'iara',
        loot: [],
        trails: {},
        preparationId: null,
        activeSeconds: 120,
      },
    };
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: saved, version: 5 }));
    const useGameStore = await openGame();
    useGameStore.getState().tick(Date.now());

    const state = useGameStore.getState();
    expect(state.expedition).toBeNull();
    expect(state.expeditionReport?.outcome).toBe('interrompida');
    expect(state.expeditionReport?.seconds).toBe(120);
    expect(state.expeditionReport?.guaranteeGold).toBeGreaterThan(0);
    expect(state.offlineReport?.summary.kills).toBeGreaterThan(0);
  });

  it('entrega os Rastros das pegadas da bolsa salva, sem os que não existem', async () => {
    const saved = {
      ...versionFourState,
      version: 5,
      world: undefined,
      expedition: {
        mapId: 'beira-da-mata',
        encantadoId: 'iara',
        loot: [],
        trails: { caipora: 2, nada: 4, boitata: -1 },
        preparationId: 'preparo-que-nao-existe',
      },
    };
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ state: saved, version: 5 }));
    const useGameStore = await openGame();
    const trailsBefore = useGameStore.getState().trails.caipora ?? 0;

    // Encantado que não existe sai. Número negativo vira zero, como nos outros contadores.
    expect(useGameStore.getState().expedition?.trails).toEqual({ caipora: 2, boitata: 0 });
    expect(useGameStore.getState().expedition?.preparationId).toBeNull();
    runTicks(useGameStore, 1);
    expect(useGameStore.getState().expeditionReport?.outcome).toBe('interrompida');
    expect(useGameStore.getState().trails.caipora).toBe(Math.min(3, trailsBefore + 2));
  });

  it('só grava a direção quando muda e só guarda o golpe especial em expedição', async () => {
    const useGameStore = await openGame();
    useGameStore.getState().triggerSpecial();
    expect(useGameStore.getState().isSpecialPending).toBe(false);

    useGameStore.getState().setMoveInput({ moveX: 1, moveY: 0 });
    const first = useGameStore.getState().moveInput;
    useGameStore.getState().setMoveInput({ moveX: 1, moveY: 0 });
    expect(useGameStore.getState().moveInput).toBe(first);
  });
});
