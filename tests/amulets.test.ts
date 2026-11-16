/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/amulets.test.ts
 * O que faz: testa as regras dos amuletos (src/domain/amulets.ts) sem
 * navegador: queda, geração de atributos, mochila, vestir, desmanche e
 * entalhe. O sorteio usa semente, então todo resultado é repetível, e o
 * estado de entrada é congelado, para denunciar qualquer alteração indevida.
 */

import { describe, expect, it } from 'vitest';

import { AMULET_BASES, AMULET_RARITIES, BALANCE } from '../src/data';
import { chooseStarter } from '../src/domain/actions';
import {
  carveAmulet,
  compareRarity,
  equipAmulet,
  generateAmulet,
  getBagAmulets,
  getCarveCost,
  getEffectiveBonuses,
  getPartyAmuletBonuses,
  getSalvageValue,
  isBagFull,
  receiveAmulet,
  rollAmuletDrop,
  salvageAmulet,
  salvageBagUpTo,
  setAutoSalvage,
  unequipAmulet,
} from '../src/domain/amulets';
import { getAmuletBase } from '../src/domain/catalog';
import { getModifiers } from '../src/domain/modifiers';
import { advanceSimulation } from '../src/domain/simulation';
import { createInitialState, createOwnedEncantado } from '../src/domain/state';
import type { Amulet, GameState, Rarity } from '../src/domain/types';
import { createSeededRandom } from '../src/utils/random';

// Congela o objeto inteiro. Alterar um objeto congelado lança erro nos testes.
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

// Jogo com o Saci na comitiva e a Caipora no elenco, fora da comitiva
function createGame(changes: Partial<GameState> = {}): GameState {
  const started = chooseStarter(createInitialState(0, createSeededRandom(1)), 'saci');

  if (started === null) {
    throw new Error('O Saci deveria ser um encantado inicial.');
  }

  const roster = { ...started.roster, caipora: createOwnedEncantado('caipora') };
  return deepFreeze({ ...started, roster, ...changes });
}

// Amuleto montado à mão, para os testes que não dependem de sorteio
function createAmulet(id: string, rarity: Rarity, changes: Partial<Amulet> = {}): Amulet {
  return {
    id,
    baseId: 'figa',
    rarity,
    foundAtStage: 1,
    level: 0,
    bonuses: [{ stat: 'damage', value: 0.2 }],
    ...changes,
  };
}

// Estado com os amuletos informados já na mochila
function withAmulets(state: GameState, amulets: Amulet[]): GameState {
  const entries = amulets.map((amulet) => [amulet.id, amulet] as const);
  return deepFreeze({ ...state, amulets: Object.fromEntries(entries) });
}

describe('tabelas dos amuletos', () => {
  it('tem pesos positivos, raridades em ordem crescente e um atributo por tipo', () => {
    const stats = AMULET_BASES.map((base) => base.stat);
    expect(new Set(stats).size).toBe(stats.length);
    expect(AMULET_RARITIES.every((definition) => definition.weight > 0)).toBe(true);

    for (let index = 1; index < AMULET_RARITIES.length; index += 1) {
      const rarer = AMULET_RARITIES[index];
      const commoner = AMULET_RARITIES[index - 1];
      expect(rarer?.weight).toBeLessThan(commoner?.weight ?? 0);
      expect(rarer?.bonusMultiplier).toBeGreaterThan(commoner?.bonusMultiplier ?? 0);
    }
  });
});

describe('queda e geração', () => {
  it('gera o mesmo amuleto com a mesma semente', () => {
    const first = generateAmulet(7, 12, createSeededRandom(42));
    const second = generateAmulet(7, 12, createSeededRandom(42));
    expect(second).toEqual(first);
    expect(first.id).toBe('amuleto-7');
    expect(first.level).toBe(0);
    expect(first.foundAtStage).toBe(12);
  });

  it('sorteia as raridades na proporção dos pesos', () => {
    const random = createSeededRandom(2026);
    const counts: Record<string, number> = {};
    const total = 20_000;

    for (let roll = 0; roll < total; roll += 1) {
      const rarity = generateAmulet(roll, 1, random).rarity;
      counts[rarity] = (counts[rarity] ?? 0) + 1;
    }

    for (const definition of AMULET_RARITIES) {
      const share = ((counts[definition.rarity] ?? 0) / total) * 100;
      expect(Math.abs(share - definition.weight)).toBeLessThan(1.2);
    }
  });

  it('dá o bônus principal do tipo e os secundários da raridade, sem repetir atributo', () => {
    const random = createSeededRandom(5);

    for (let roll = 0; roll < 500; roll += 1) {
      const amulet = generateAmulet(roll, 1, random);
      const rarityDef = AMULET_RARITIES.find((d) => d.rarity === amulet.rarity);
      const stats = amulet.bonuses.map((bonus) => bonus.stat);

      expect(stats[0]).toBe(getAmuletBase(amulet.baseId).stat);
      expect(amulet.bonuses).toHaveLength(1 + (rarityDef?.extraBonuses ?? 0));
      expect(new Set(stats).size).toBe(stats.length);
      expect(amulet.bonuses.every((bonus) => bonus.value > 0)).toBe(true);
    }
  });

  it('mantém o bônus principal dentro da variação prevista', () => {
    const random = createSeededRandom(9);

    for (let roll = 0; roll < 500; roll += 1) {
      const amulet = generateAmulet(roll, 1, random);
      const base = getAmuletBase(amulet.baseId);
      const multiplier = AMULET_RARITIES.find((d) => d.rarity === amulet.rarity)?.bonusMultiplier;
      const expected = base.baseBonus * (multiplier ?? 1);
      const primary = amulet.bonuses[0]?.value ?? 0;

      expect(primary).toBeGreaterThanOrEqual(expected * BALANCE.amuletVarianceMin - 0.0001);
      expect(primary).toBeLessThanOrEqual(expected * BALANCE.amuletVarianceMax + 0.0001);
    }
  });

  it('fortalece o amuleto que cai em estágio mais alto', () => {
    const early = generateAmulet(1, 1, createSeededRandom(3));
    const late = generateAmulet(1, 31, createSeededRandom(3));
    const ratio = (late.bonuses[0]?.value ?? 0) / (early.bonuses[0]?.value ?? 1);
    expect(late.rarity).toBe(early.rarity);
    expect(ratio).toBeCloseTo(1 + BALANCE.amuletStageScaling * 30, 2);
  });

  it('cai mais de chefe do que de visagem, na chance configurada', () => {
    const random = createSeededRandom(11);
    const rolls = 20_000;
    const countDrops = (isBoss: boolean): number => {
      let drops = 0;
      for (let roll = 0; roll < rolls; roll += 1) {
        const input = { stage: 1, isBoss, dropChanceMultiplier: 1, amuletNumber: roll };
        drops += rollAmuletDrop(input, random) === null ? 0 : 1;
      }
      return drops / rolls;
    };

    expect(countDrops(true)).toBeCloseTo(BALANCE.amuletBossDropChance, 1);
    expect(countDrops(false)).toBeCloseTo(BALANCE.amuletCommonDropChance, 2);
  });

  it('nunca passa de 100% de chance, por maior que seja a sorte', () => {
    const random = createSeededRandom(1);
    const input = { stage: 1, isBoss: true, dropChanceMultiplier: 50, amuletNumber: 1 };
    const drops = Array.from({ length: 200 }, () => rollAmuletDrop(input, random));
    expect(drops.every((amulet) => amulet !== null)).toBe(true);
  });
});

describe('mochila', () => {
  it('guarda o amuleto que cai, sem alterar o estado recebido', () => {
    const state = createGame();
    const result = receiveAmulet(state, createAmulet('amuleto-1', 'raro'));

    expect(result.wasSalvaged).toBe(false);
    expect(result.state.amulets['amuleto-1']?.rarity).toBe('raro');
    expect(result.state.nextAmuletNumber).toBe(2);
    expect(result.state.stats.amuletsFound).toBe(1);
    expect(state.amulets).toEqual({});
    expect(state.nextAmuletNumber).toBe(1);
  });

  it('desmancha na hora o que entra no desmanche automático', () => {
    const state = setAutoSalvage(createGame(), 'raro');
    const common = receiveAmulet(state, createAmulet('amuleto-1', 'comum'));
    const epic = receiveAmulet(state, createAmulet('amuleto-1', 'epico'));

    expect(common.wasSalvaged).toBe(true);
    expect(common.shavings).toBe(1);
    expect(common.state.shavings).toBe(1);
    expect(common.state.amulets).toEqual({});
    expect(common.state.stats.amuletsFound).toBe(1);
    expect(epic.wasSalvaged).toBe(false);
  });

  it('desmancha o que cai com a mochila cheia, mas não conta os vestidos', () => {
    const amulets = Array.from({ length: BALANCE.amuletBagSize }, (_, index) =>
      createAmulet(`amuleto-${index + 1}`, 'comum'),
    );
    const full = withAmulets(createGame(), amulets);
    expect(isBagFull(full)).toBe(true);
    expect(receiveAmulet(full, createAmulet('amuleto-99', 'lendario')).wasSalvaged).toBe(true);

    const withOneWorn = equipAmulet(full, 'saci', 'amuleto-1');
    expect(withOneWorn === null ? true : isBagFull(withOneWorn)).toBe(false);
  });

  it('lista a mochila do mais raro para o mais comum', () => {
    const state = withAmulets(createGame(), [
      createAmulet('a', 'comum'),
      createAmulet('b', 'lendario'),
      createAmulet('c', 'raro'),
    ]);
    expect(getBagAmulets(state).map((amulet) => amulet.rarity)).toEqual([
      'lendario',
      'raro',
      'comum',
    ]);
    expect(compareRarity('comum', 'raro')).toBeLessThan(0);
    expect(compareRarity('epico', 'epico')).toBe(0);
  });
});

describe('vestir e tirar', () => {
  const base = withAmulets(createGame(), [
    createAmulet('a', 'comum'),
    createAmulet('b', 'raro', { bonuses: [{ stat: 'gold', value: 0.3 }] }),
  ]);

  it('veste, troca e devolve o antigo para a mochila', () => {
    const first = equipAmulet(base, 'saci', 'a');
    expect(first?.equipped).toEqual({ saci: 'a' });
    expect(base.equipped).toEqual({});

    const swapped = first === null ? null : equipAmulet(first, 'saci', 'b');
    expect(swapped?.equipped).toEqual({ saci: 'b' });
    expect(swapped === null ? [] : getBagAmulets(swapped).map((amulet) => amulet.id)).toEqual([
      'a',
    ]);
  });

  it('passa o amuleto de um encantado para outro', () => {
    const worn = equipAmulet(base, 'saci', 'a');
    const moved = worn === null ? null : equipAmulet(worn, 'caipora', 'a');
    expect(moved?.equipped).toEqual({ caipora: 'a' });
  });

  it('recusa o que não existe ou já está vestido ali', () => {
    expect(equipAmulet(base, 'iara', 'a')).toBeNull();
    expect(equipAmulet(base, 'saci', 'nao-existe')).toBeNull();
    const worn = equipAmulet(base, 'saci', 'a');
    expect(worn === null ? null : equipAmulet(worn, 'saci', 'a')).toBeNull();
    expect(unequipAmulet(base, 'saci')).toBeNull();
    expect(worn === null ? null : unequipAmulet(worn, 'saci')?.equipped).toEqual({});
  });

  it('só vale o amuleto de quem está na comitiva', () => {
    const onSaci = equipAmulet(base, 'saci', 'a');
    const onCaipora = equipAmulet(base, 'caipora', 'a');

    expect(onSaci === null ? [] : getPartyAmuletBonuses(onSaci)).toEqual([
      { stat: 'damage', value: 0.2 },
    ]);
    expect(onCaipora === null ? null : getPartyAmuletBonuses(onCaipora)).toEqual([]);
  });

  it('entra nos multiplicadores do combate', () => {
    const before = getModifiers(base, 'dia');
    const worn = equipAmulet(base, 'saci', 'a');
    const after = worn === null ? before : getModifiers(worn, 'dia');
    expect(after.damage).toBeCloseTo(before.damage * 1.2, 6);
    expect(after.gold).toBe(before.gold);
  });
});

describe('desmanche', () => {
  const base = withAmulets(createGame({ shavings: 5 }), [
    createAmulet('a', 'comum'),
    createAmulet('b', 'comum'),
    createAmulet('c', 'raro'),
    createAmulet('d', 'epico', { foundAtStage: 26 }),
  ]);

  it('rende Cavacos pela raridade e pelo estágio em que caiu', () => {
    expect(getSalvageValue(createAmulet('x', 'comum'))).toBe(1);
    expect(getSalvageValue(createAmulet('x', 'raro'))).toBe(3);
    expect(getSalvageValue(createAmulet('x', 'epico', { foundAtStage: 26 }))).toBe(18);
  });

  it('desmancha um amuleto da mochila, mas não um vestido', () => {
    const salvaged = salvageAmulet(base, 'c');
    expect(salvaged?.shavings).toBe(8);
    expect(salvaged?.amulets.c).toBeUndefined();
    expect(base.shavings).toBe(5);

    const worn = equipAmulet(base, 'saci', 'c');
    expect(worn === null ? 'erro' : salvageAmulet(worn, 'c')).toBeNull();
    expect(salvageAmulet(base, 'nao-existe')).toBeNull();
  });

  it('desmancha em lote até uma raridade e poupa os vestidos', () => {
    const worn = equipAmulet(base, 'saci', 'a');
    const cleaned = worn === null ? null : salvageBagUpTo(worn, 'raro');
    expect(Object.keys(cleaned?.amulets ?? {}).sort()).toEqual(['a', 'd']);
    expect(cleaned?.shavings).toBe(5 + 1 + 3);
    expect(cleaned === null ? 'erro' : salvageBagUpTo(cleaned, 'raro')).toBeNull();
  });
});

describe('entalhe', () => {
  it('gasta Cavacos, sobe o nível e fortalece os bônus', () => {
    const state = withAmulets(createGame({ shavings: 10 }), [createAmulet('a', 'comum')]);
    const carved = carveAmulet(state, 'a');
    const amulet = carved?.amulets.a;

    expect(getCarveCost(createAmulet('a', 'comum'))).toBe(4);
    expect(carved?.shavings).toBe(6);
    expect(amulet?.level).toBe(1);
    expect(amulet === undefined ? [] : getEffectiveBonuses(amulet)).toEqual([
      { stat: 'damage', value: 0.22 },
    ]);
    expect(state.amulets.a?.level).toBe(0);
  });

  it('custa mais a cada nível e conforme a raridade', () => {
    expect(getCarveCost(createAmulet('a', 'comum', { level: 1 }))).toBe(6);
    expect(getCarveCost(createAmulet('a', 'lendario'))).toBe(32);
  });

  it('recusa sem Cavacos, no nível máximo ou sem o amuleto', () => {
    const poor = withAmulets(createGame({ shavings: 3 }), [createAmulet('a', 'comum')]);
    const maxed = withAmulets(createGame({ shavings: 999 }), [
      createAmulet('a', 'comum', { level: 5 }),
    ]);
    expect(carveAmulet(poor, 'a')).toBeNull();
    expect(carveAmulet(maxed, 'a')).toBeNull();
    expect(carveAmulet(maxed, 'nao-existe')).toBeNull();
  });

  it('devolve no desmanche metade do que foi gasto no entalhe', () => {
    const carvedTwice = createAmulet('a', 'comum', { level: 2 });
    expect(getSalvageValue(carvedTwice)).toBe(Math.round(1 + (4 + 6) * BALANCE.carveRefundRate));
  });
});

describe('amuletos dentro da simulação', () => {
  it('faz cair amuletos durante o combate e fecha as contas com o resumo', () => {
    const start = createGame();
    const options = { startTimestamp: 0, random: createSeededRandom(21), collectEvents: true };
    const { state, summary, events } = advanceSimulation(start, 1800, options);
    const amuletEvents = events.filter((event) => event.type === 'amulet');
    const kept = Object.keys(state.amulets).length;

    expect(summary.amuletsFound).toBeGreaterThan(0);
    expect(state.stats.amuletsFound).toBe(summary.amuletsFound);
    expect(amuletEvents).toHaveLength(summary.amuletsFound);
    expect(kept).toBe(summary.amuletsFound - summary.amuletsSalvaged);
    expect(state.shavings).toBe(summary.shavings);
    expect(state.nextAmuletNumber).toBe(1 + summary.amuletsFound);
    expect(start.amulets).toEqual({});
  });

  it('não passa do limite da mochila em uma ausência longa', () => {
    const options = { startTimestamp: 0, random: createSeededRandom(8) };
    const { state, summary } = advanceSimulation(createGame(), 4 * 3600, options);

    expect(summary.amuletsFound).toBeGreaterThan(BALANCE.amuletBagSize);
    expect(getBagAmulets(state)).toHaveLength(BALANCE.amuletBagSize);
    expect(summary.amuletsSalvaged).toBe(summary.amuletsFound - BALANCE.amuletBagSize);
    expect(state.shavings).toBeGreaterThan(0);
  });
});
