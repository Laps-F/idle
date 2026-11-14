/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/__tests__/store.test.ts
 * O que faz: testa a store como a interface vai usar: tick, ausência,
 * gravação no localStorage, exportar, importar e apagar tudo.
 * O localStorage e o relógio são simulados, porque o teste roda fora do navegador.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BALANCE, MS_PER_SECOND } from '../data';
import { SAVE_STORAGE_KEY } from '../store/saveManager';

const START = 1_800_000_000_000;
const ONE_HOUR_MS = 3600 * MS_PER_SECOND;

type StoreModule = typeof import('../store/useGameStore');

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
  const module: StoreModule = await import('../store/useGameStore');
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
    expect(state.roster.saci.level).toBe(1);
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
    const { claimActiveTab } = await import('../store/tabGuard');
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
