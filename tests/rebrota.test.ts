/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/rebrota.test.ts
 * O que faz: testa as regras da Rebrota (src/domain/rebrota.ts) e do juazeiro
 * (src/domain/juazeiro.ts) sem navegador: quanto a Rebrota rende, quando
 * libera, o que fica e o que volta ao começo, compra de nós, efeito de cada
 * galho e a compra automática de melhorias. O estado de entrada é congelado,
 * para denunciar qualquer alteração indevida.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE, JUAZEIRO_NODES } from '../src/data';
import { chooseStarter } from '../src/domain/actions';
import { getRootsForRebrota } from '../src/domain/formulas';
import {
  buyJuazeiroNode,
  canBuyNode,
  getBagSize,
  getBossTimeLimit,
  getFreeRoots,
  getNodeCost,
  getOfflineRules,
  getSpentRoots,
} from '../src/domain/juazeiro';
import { getModifiers } from '../src/domain/modifiers';
import { applyOfflineProgress } from '../src/domain/offline';
import {
  autoBuyUpgrades,
  canRebrota,
  getNextRootStage,
  getRebrotaGain,
  getRebrotaStageNeeded,
  getRootsPerHour,
  isJuazeiroRevealed,
  performRebrota,
  setAutoBuy,
} from '../src/domain/rebrota';
import { advanceSimulation } from '../src/domain/simulation';
import { createInitialState, createOwnedEncantado } from '../src/domain/state';
import type { GameState } from '../src/domain/types';
import { createSeededRandom } from '../src/utils/random';

// Congela o objeto inteiro. Alterar um objeto congelado lança erro nos testes.
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

// Jogo com o Saci na comitiva e as mudanças pedidas
function createGame(changes: Partial<GameState> = {}): GameState {
  const started = chooseStarter(createInitialState(0, createSeededRandom(1)), 'saci');

  if (started === null) {
    throw new Error('O Saci deveria ser um encantado inicial.');
  }

  return deepFreeze({ ...started, ...changes });
}

// Jogo no meio da edição 1, com tudo que a Rebrota deve manter ou zerar
function createRichGame(changes: Partial<GameState> = {}): GameState {
  return createGame({
    gold: 5000,
    stage: 38,
    maxStage: 40,
    killsInStage: 4,
    roster: {
      saci: { ...createOwnedEncantado('saci'), level: 30, xp: 50, bond: 2 },
      caipora: { ...createOwnedEncantado('caipora'), level: 22 },
    },
    party: ['saci', 'caipora'],
    trails: { boitata: 3 },
    inventory: { 'mel-silvestre': 40 },
    upgrades: { 'reza-forte': 12 },
    shavings: 25,
    amulets: {
      'amuleto-1': {
        id: 'amuleto-1',
        baseId: 'figa',
        rarity: 'raro',
        foundAtStage: 20,
        level: 2,
        bonuses: [{ stat: 'damage', value: 0.2 }],
      },
    },
    equipped: { saci: 'amuleto-1' },
    editionSeconds: 1800,
    ...changes,
  });
}

describe('quanto a Rebrota rende', () => {
  it('rende as Raízes do maior estágio na primeira edição', () => {
    const state = createGame({ maxStage: 40 });
    expect(getRebrotaGain(state)).toBe(8);
    expect(getRebrotaGain(createGame({ maxStage: 30 }))).toBe(5);
  });

  it('só conta o que passa do recorde das edições passadas', () => {
    expect(getRebrotaGain(createGame({ maxStage: 50, recordStage: 40 }))).toBe(11 - 8);
    expect(getRebrotaGain(createGame({ maxStage: 40, recordStage: 40 }))).toBe(0);
    expect(getRebrotaGain(createGame({ maxStage: 20, recordStage: 40 }))).toBe(0);
  });

  it('aponta o estágio da próxima Raiz', () => {
    const state = createGame({ maxStage: 40 });
    const next = getNextRootStage(state);
    expect(getRootsForRebrota(next)).toBe(getRootsForRebrota(40) + 1);
    expect(getRootsForRebrota(next - 1)).toBe(getRootsForRebrota(40));
  });

  it('mede as Raízes por hora da edição', () => {
    expect(getRootsPerHour(createGame({ maxStage: 40, editionSeconds: 1800 }))).toBe(16);
    expect(getRootsPerHour(createGame({ maxStage: 40, editionSeconds: 0 }))).toBe(0);
  });
});

describe('quando a Rebrota libera e aparece', () => {
  it('pede o estágio 35 na primeira edição', () => {
    expect(getRebrotaStageNeeded(createGame())).toBe(BALANCE.rebrotaFirstStage);
    expect(canRebrota(createGame({ maxStage: 34 }))).toBe(false);
    expect(canRebrota(createGame({ maxStage: 35 }))).toBe(true);
  });

  it('depois pede só o mínimo de Raízes acima do recorde', () => {
    const state = createGame({ recordStage: 40, maxStage: 40 });
    const needed = getRebrotaStageNeeded(state);
    const extra = getRootsForRebrota(needed) - getRootsForRebrota(40);

    expect(extra).toBeGreaterThanOrEqual(BALANCE.rebrotaMinRoots);
    expect(getRootsForRebrota(needed - 1) - getRootsForRebrota(40)).toBeLessThan(3);
    expect(canRebrota({ ...state, maxStage: needed - 1 })).toBe(false);
    expect(canRebrota({ ...state, maxStage: needed })).toBe(true);
  });

  it('não libera sem comitiva', () => {
    expect(canRebrota(createGame({ maxStage: 60, party: [] }))).toBe(false);
  });

  it('revela o juazeiro no primeiro chefe perdido, na Rebrota liberada ou depois dela', () => {
    const fresh = createGame();
    expect(isJuazeiroRevealed(fresh)).toBe(false);
    expect(isJuazeiroRevealed({ ...fresh, stats: { ...fresh.stats, bossesFailed: 1 } })).toBe(true);
    expect(isJuazeiroRevealed({ ...fresh, maxStage: 35 })).toBe(true);
    expect(isJuazeiroRevealed({ ...fresh, edition: 2 })).toBe(true);
  });
});

describe('rebrotar', () => {
  const before = createRichGame();
  const after = performRebrota(before, createSeededRandom(3));

  it('começa a edição seguinte no estágio 1, com as Raízes ganhas', () => {
    expect(after?.edition).toBe(2);
    expect(after?.stage).toBe(1);
    expect(after?.maxStage).toBe(1);
    expect(after?.killsInStage).toBe(0);
    expect(after?.roots).toBe(8);
    expect(after?.recordStage).toBe(40);
    expect(after?.editionSeconds).toBe(0);
    expect(after?.combat.isBoss).toBe(false);
  });

  it('zera Patacas, melhorias, Oferendas e o nível dos encantados', () => {
    expect(after?.gold).toBe(0);
    expect(after?.upgrades).toEqual({});
    expect(after?.inventory).toEqual({});
    expect(after?.roster.saci).toEqual({ id: 'saci', level: 1, xp: 0, bond: 2 });
    expect(after?.roster.caipora?.level).toBe(1);
  });

  it('mantém elenco, comitiva, Rastros, amuletos, Cavacos e estatísticas', () => {
    expect(after?.party).toEqual(['saci', 'caipora']);
    expect(after?.trails).toEqual({ boitata: 3 });
    expect(after?.amulets).toEqual(before.amulets);
    expect(after?.equipped).toEqual({ saci: 'amuleto-1' });
    expect(after?.shavings).toBe(25);
    expect(after?.stats).toEqual(before.stats);
  });

  it('recusa quando ainda não está liberada', () => {
    expect(performRebrota(createRichGame({ maxStage: 30 }), createSeededRandom(1))).toBeNull();
  });

  it('a edição seguinte só rende o que passar do novo recorde', () => {
    expect(after === null ? -1 : getRebrotaGain({ ...after, maxStage: 40 })).toBe(0);
    expect(after === null ? -1 : getRebrotaGain({ ...after, maxStage: 50 })).toBe(3);
  });
});

describe('juazeiro', () => {
  const base = createGame({ roots: 10 });

  it('compra com Raízes livres, sem tirar as fincadas', () => {
    const bought = buyJuazeiroNode(base, 'cerne-duro');
    expect(bought?.juazeiro).toEqual({ 'cerne-duro': 1 });
    expect(bought?.roots).toBe(10);
    expect(bought === null ? -1 : getFreeRoots(bought)).toBe(9);
    expect(base.juazeiro).toEqual({});
  });

  it('cobra mais a cada nível e soma o que foi gasto', () => {
    const espinho = JUAZEIRO_NODES.find((node) => node.id === 'espinho-velho');
    expect(espinho === undefined ? -1 : getNodeCost(espinho, 0)).toBe(2);
    expect(espinho === undefined ? -1 : getNodeCost(espinho, 2)).toBe(6);
    expect(getSpentRoots({ 'cerne-duro': 3, 'espinho-velho': 2 })).toBe(1 + 2 + 3 + 2 + 4);
  });

  it('recusa sem Raízes livres, no máximo ou com nó que não existe', () => {
    expect(buyJuazeiroNode(createGame({ roots: 7 }), 'mao-ligeira')).toBeNull();
    expect(
      buyJuazeiroNode(createGame({ roots: 99, juazeiro: { 'mao-ligeira': 1 } }), 'mao-ligeira'),
    ).toBeNull();
    expect(buyJuazeiroNode(base, 'no-inventado')).toBeNull();
    expect(canBuyNode(base, 'no-inventado')).toBe(false);
  });

  it('o galho da Força soma dano, dano em chefe, crítico e tempo do chefe', () => {
    const strong = createGame({
      juazeiro: {
        'cerne-duro': 2,
        'espinho-velho': 1,
        'golpe-de-facao': 1,
        'folego-de-vaqueiro': 2,
      },
    });
    const plain = getModifiers(base, 'dia');
    const boosted = getModifiers(strong, 'dia');

    expect(boosted.damage / getModifiers(createGame(), 'dia').damage).toBeCloseTo(1.3, 6);
    expect(boosted.bossDamage / plain.bossDamage).toBeCloseTo(1.2, 6);
    expect(boosted.critChance - plain.critChance).toBeCloseTo(0.03, 6);
    expect(getBossTimeLimit(strong)).toBe(getBossTimeLimit(base) + 6);
  });

  it('o galho da Lua soma Rastros, Oferendas, amuletos e vagas na mochila', () => {
    const lucky = createGame({
      juazeiro: { 'faro-de-mateiro': 1, 'mao-de-rezadeira': 2, patua: 1, 'bornal-fundo': 1 },
    });
    const modifiers = getModifiers(lucky, 'dia');

    expect(modifiers.trailChance / modifiers.dropChance).toBeCloseTo(1.25, 6);
    expect(modifiers.itemChance / modifiers.dropChance).toBeCloseTo(1.5, 6);
    expect(modifiers.amuletChance / modifiers.dropChance).toBeCloseTo(1.2, 6);
    expect(getBagSize(lucky)).toBe(BALANCE.amuletBagSize + 10);
  });

  it('o galho do Vento muda as regras da ausência', () => {
    const rested = createGame({ juazeiro: { 'rede-de-dormir': 2, 'noite-comprida': 1 } });
    expect(getOfflineRules(base)).toEqual({ capSeconds: 8 * 3600, efficiency: 0.5 });
    expect(getOfflineRules(rested).capSeconds).toBe(10 * 3600);
    expect(getOfflineRules(rested).efficiency).toBeCloseTo(0.7, 6);

    const report = applyOfflineProgress(rested, 12 * 3600 * 1000, createSeededRandom(2)).report;
    expect(report?.capSeconds).toBe(10 * 3600);
    expect(report?.secondsSimulated).toBeCloseTo(10 * 3600 * 0.7, 3);
  });

  it('o atalho da trilha começa adiante, sempre abaixo do recorde', () => {
    const shortcut = createRichGame({ juazeiro: { 'atalho-da-trilha': 2 }, roots: 20 });
    expect(performRebrota(shortcut, createSeededRandom(1))?.stage).toBe(11);

    // Com o atalho completo e o menor recorde possível (o da primeira Rebrota), o
    // início fica abaixo do limite de rebrotaStageMargin estágios antes do recorde.
    const full = createRichGame({
      juazeiro: { 'atalho-da-trilha': 4 },
      roots: 30,
      maxStage: BALANCE.rebrotaFirstStage,
    });
    const started = performRebrota(full, createSeededRandom(1));
    expect(started?.stage).toBe(21);
    expect(started?.maxStage).toBe(21);
    expect(started?.stage ?? 99).toBeLessThanOrEqual(
      BALANCE.rebrotaFirstStage - BALANCE.rebrotaStageMargin,
    );
  });

  it('a bolsa herdada dá Patacas no começo da edição', () => {
    const heir = createRichGame({ juazeiro: { 'bolsa-herdada': 2 }, roots: 20 });
    const started = performRebrota(heir, createSeededRandom(1));
    expect(started?.gold).toBe(2 * BALANCE.startGoldKills * 2);
  });
});

describe('compra automática de melhorias', () => {
  it('só liga com a Mão ligeira, que já vem ligada ao ser comprada', () => {
    expect(setAutoBuy(createGame(), true)).toBeNull();
    const bought = buyJuazeiroNode(createGame({ roots: 8 }), 'mao-ligeira');
    expect(bought?.autoBuy).toBe(true);
    expect(bought === null ? null : setAutoBuy(bought, false)?.autoBuy).toBe(false);
    expect(bought === null ? 'erro' : setAutoBuy(bought, true)).toBeNull();
  });

  it('compra a melhoria mais barata enquanto houver Patacas', () => {
    const state = createGame({ gold: 100, juazeiro: { 'mao-ligeira': 1 }, autoBuy: true });
    const bought = autoBuyUpgrades(state);
    const levels = Object.values(bought.upgrades).reduce((sum, level) => sum + level, 0);

    expect(levels).toBeGreaterThan(2);
    expect(bought.gold).toBeLessThan(10);
    expect(autoBuyUpgrades({ ...state, autoBuy: false }).upgrades).toEqual({});
    expect(autoBuyUpgrades({ ...state, juazeiro: {} }).upgrades).toEqual({});
  });

  it('compra durante a simulação e acelera o jogo', () => {
    const options = { startTimestamp: 0, random: createSeededRandom(5) };
    const manual = advanceSimulation(createGame(), 600, options).state;
    const automatic = advanceSimulation(
      createGame({ juazeiro: { 'mao-ligeira': 1 }, autoBuy: true }),
      600,
      { startTimestamp: 0, random: createSeededRandom(5) },
    ).state;

    expect(manual.upgrades).toEqual({});
    expect(Object.keys(automatic.upgrades).length).toBeGreaterThan(0);
    expect(automatic.maxStage).toBeGreaterThan(manual.maxStage);
  });
});

describe('tempo da edição', () => {
  it('a simulação conta o tempo da edição junto com o tempo total', () => {
    const { state } = advanceSimulation(createGame({ editionSeconds: 10 }), 60, {
      startTimestamp: 0,
      random: createSeededRandom(1),
    });
    expect(state.editionSeconds).toBeCloseTo(70, 6);
  });
});
