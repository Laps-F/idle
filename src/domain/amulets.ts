/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/amulets.ts
 * O que faz: todas as regras dos amuletos, o primeiro sistema de retenção do
 * jogo. Um amuleto cai de um inimigo derrotado, com raridade e bônus
 * sorteados. Quem está na comitiva pode vestir um. Os que não servem são
 * desmanchados em Cavacos, e os Cavacos pagam o entalhe, que fortalece os
 * amuletos que ficam.
 *
 * Módulo puro: não conhece a store nem o React, não lê o relógio e não
 * sorteia por conta própria. Todo sorteio usa a fonte recebida por parâmetro,
 * então a mesma semente gera sempre o mesmo amuleto. As ações recebem o
 * estado e devolvem um estado novo, ou null quando não são permitidas.
 *
 * Mapa:
 *   1. Tipos
 *   2. Queda: sorteio e geração de atributos
 *   3. Bônus em vigor
 *   4. Mochila e chegada de um amuleto
 *   5. Vestir e tirar
 *   6. Desmanche
 *   7. Entalhe
 *   8. Ferramentas
 */

import { AMULET_BASES, AMULET_RARITIES } from '../data/amulets';
import { BALANCE } from '../data/balance';
import { pickRandom, pickWeighted } from '../utils/random';
import type { RandomSource } from '../utils/random';
import { getAmuletRarity } from './catalog';
import { getBagSize } from './juazeiro';
import type { Amulet, AmuletBaseDef, AmuletBonus, GameState, Rarity } from './types';

// =============================================================================
// =============================================================================
// T I P O S

// De onde vem a queda: estágio, tipo de inimigo e sorte da comitiva
export interface AmuletDropInput {
  stage: number;
  isBoss: boolean;
  dropChanceMultiplier: number; // multiplicador de chance de amuleto (achado e juazeiro)
  amuletNumber: number; // número que vira o id do amuleto, se ele cair
}

// O que aconteceu com um amuleto que acabou de cair
export interface ReceiveResult {
  state: GameState;
  wasSalvaged: boolean; // true se foi desmanchado na hora, em vez de ir para a mochila
  shavings: number; // Cavacos rendidos pelo desmanche. Zero se foi guardado.
}

// Ordem das raridades, da mais comum para a mais rara
const RARITY_ORDER: readonly Rarity[] = AMULET_RARITIES.map((definition) => definition.rarity);


// =============================================================================
// =============================================================================
// Q U E D A

/**
 * Decide se um inimigo derrotado deixa cair um amuleto e, se deixar, gera o amuleto.
 *
 * A chance vem de BALANCE (uma para chefe, outra para visagem comum), vezes o
 * multiplicador de chance de achado da comitiva, limitada a 100%.
 *
 * Função pura e determinística: com a mesma fonte de sorteio, devolve sempre o mesmo.
 *
 * @param input Estágio, tipo do inimigo, multiplicador de sorte e número do amuleto.
 * @param random Fonte de números aleatórios. Consome um número para a chance e,
 *               se o amuleto cair, mais alguns para gerar os atributos.
 * @returns O amuleto gerado, ou null se nada caiu.
 */
export function rollAmuletDrop(input: AmuletDropInput, random: RandomSource): Amulet | null {
  const baseChance = input.isBoss ? BALANCE.amuletBossDropChance : BALANCE.amuletCommonDropChance;
  const chance = Math.min(1, baseChance * input.dropChanceMultiplier);

  if (random() >= chance) {
    return null;
  }

  return generateAmulet(input.amuletNumber, input.stage, random);
}

/**
 * Gera um amuleto: sorteia a raridade, o tipo e os valores dos bônus.
 *
 * Ordem dos sorteios (importa para repetir um resultado com a mesma semente):
 * 1. raridade, pelos pesos de AMULET_RARITIES;
 * 2. tipo, com a mesma chance para todos;
 * 3. valor do bônus principal;
 * 4. para cada bônus secundário: qual atributo e qual valor.
 *
 * Valor de um bônus = bônus base do tipo × multiplicador da raridade ×
 * escala do estágio × variação sorteada. Bônus secundário vale uma fração
 * (amuletExtraBonusFactor) do bônus base do atributo dele.
 *
 * @param amuletNumber Número que identifica o amuleto. O id fica "amuleto-<número>".
 * @param stage Estágio em que caiu. Estágio mais alto dá bônus maiores.
 * @param random Fonte de números aleatórios.
 * @returns Amuleto sem entalhe (nível 0), com o bônus principal na primeira posição.
 *
 * Casos de borda: os bônus secundários nunca repetem o atributo do principal nem
 * entre si. Se a raridade pede mais secundários do que há atributos sobrando, o
 * amuleto fica com os que couberem.
 */
export function generateAmulet(amuletNumber: number, stage: number, random: RandomSource): Amulet {
  const rarityDef = pickWeighted(AMULET_RARITIES, random);
  const base = pickRandom(AMULET_BASES, random);
  const scale = rarityDef.bonusMultiplier * getStageScale(stage);
  const primaryValue = rollBonusValue(base.baseBonus, scale, random);
  const primary: AmuletBonus = { stat: base.stat, value: primaryValue };
  const extras = rollExtraBonuses(base, rarityDef.extraBonuses, scale, random);

  return {
    id: `amuleto-${amuletNumber}`,
    baseId: base.id,
    rarity: rarityDef.rarity,
    foundAtStage: stage,
    level: 0,
    bonuses: [primary, ...extras],
  };
}

// Sorteia os bônus secundários, cada um de um atributo diferente
function rollExtraBonuses(
  primaryBase: AmuletBaseDef,
  count: number,
  scale: number,
  random: RandomSource,
): AmuletBonus[] {
  const available = AMULET_BASES.filter((base) => base.stat !== primaryBase.stat);
  const extras: AmuletBonus[] = [];

  while (extras.length < count && available.length > 0) {
    const picked = pickRandom(available, random);
    const baseValue = picked.baseBonus * BALANCE.amuletExtraBonusFactor;

    extras.push({ stat: picked.stat, value: rollBonusValue(baseValue, scale, random) });
    available.splice(available.indexOf(picked), 1);
  }

  return extras;
}

// Valor de um bônus com a variação sorteada, arredondado para quatro casas
function rollBonusValue(baseValue: number, scale: number, random: RandomSource): number {
  const varianceRange = BALANCE.amuletVarianceMax - BALANCE.amuletVarianceMin;
  const variance = BALANCE.amuletVarianceMin + random() * varianceRange;
  return roundBonus(baseValue * scale * variance);
}

// Quanto o estágio fortalece um amuleto: 1 no estágio 1, crescendo em linha reta
function getStageScale(stage: number): number {
  return 1 + BALANCE.amuletStageScaling * (Math.max(1, stage) - 1);
}


// =============================================================================
// =============================================================================
// B Ô N U S   E M   V I G O R

// Bônus do amuleto já com o entalhe: cada nível soma amuletLevelBonus sobre o valor sorteado
export function getEffectiveBonuses(amulet: Amulet): AmuletBonus[] {
  const levelMultiplier = 1 + BALANCE.amuletLevelBonus * amulet.level;

  return amulet.bonuses.map((bonus) => ({
    stat: bonus.stat,
    value: roundBonus(bonus.value * levelMultiplier),
  }));
}

/**
 * Lista os bônus de amuleto que estão valendo para a comitiva.
 *
 * Um amuleto só vale enquanto quem o veste está na comitiva. Amuleto na mochila
 * ou vestido por alguém fora da comitiva não conta.
 *
 * @param state Estado do jogo. Só é lido.
 * @returns Todos os bônus em vigor, já com o entalhe. Atributos repetidos aparecem
 *          mais de uma vez e são somados por quem chama (src/domain/modifiers.ts).
 */
export function getPartyAmuletBonuses(state: GameState): AmuletBonus[] {
  return state.party.flatMap((encantadoId) => {
    const amuletId = state.equipped[encantadoId];
    const amulet = amuletId === undefined ? undefined : state.amulets[amuletId];
    return amulet === undefined ? [] : getEffectiveBonuses(amulet);
  });
}


// =============================================================================
// =============================================================================
// M O C H I L A

// Amuletos que não estão vestidos em ninguém, do mais raro para o mais comum
export function getBagAmulets(state: GameState): Amulet[] {
  const equippedIds = new Set(Object.values(state.equipped));
  const bag = Object.values(state.amulets).filter((amulet) => !equippedIds.has(amulet.id));
  return bag.sort((first, second) => compareRarity(second.rarity, first.rarity));
}

// Diz se a mochila chegou ao limite. Amuleto vestido não ocupa lugar.
export function isBagFull(state: GameState): boolean {
  return getBagAmulets(state).length >= getBagSize(state);
}

// Id do encantado que veste o amuleto, ou null se ele está na mochila
export function getWearerId(state: GameState, amuletId: string): string | null {
  const entry = Object.entries(state.equipped).find(([, equippedId]) => equippedId === amuletId);
  return entry === undefined ? null : entry[0];
}

/**
 * Recebe um amuleto que acabou de cair: guarda na mochila ou desmancha na hora.
 *
 * Função pura: não altera "state".
 *
 * @param state Estado de partida. Não é alterado.
 * @param amulet Amuleto gerado por rollAmuletDrop ou generateAmulet.
 * @returns Estado novo, se o amuleto foi desmanchado e quantos Cavacos rendeu.
 *
 * Casos de borda:
 * - Raridade dentro do desmanche automático (state.autoSalvage): vira Cavacos na hora.
 * - Mochila cheia: também vira Cavacos, para a queda nunca se perder.
 * - Nos dois casos o amuleto conta como encontrado e o contador de ids avança.
 */
export function receiveAmulet(state: GameState, amulet: Amulet): ReceiveResult {
  const counted: GameState = {
    ...state,
    nextAmuletNumber: state.nextAmuletNumber + 1,
    stats: { ...state.stats, amuletsFound: state.stats.amuletsFound + 1 },
  };
  const shouldSalvage = isAutoSalvaged(state.autoSalvage, amulet.rarity) || isBagFull(state);

  if (shouldSalvage) {
    const shavings = getSalvageValue(amulet);
    return {
      state: { ...counted, shavings: counted.shavings + shavings },
      wasSalvaged: true,
      shavings,
    };
  }

  return {
    state: { ...counted, amulets: { ...counted.amulets, [amulet.id]: amulet } },
    wasSalvaged: false,
    shavings: 0,
  };
}

// Diz se a raridade entra no desmanche automático configurado
function isAutoSalvaged(autoSalvage: Rarity | null, rarity: Rarity): boolean {
  return autoSalvage !== null && compareRarity(rarity, autoSalvage) <= 0;
}


// =============================================================================
// =============================================================================
// V E S T I R   E   T I R A R

/**
 * Veste um amuleto em um encantado do elenco.
 *
 * @param state Estado de partida. Não é alterado.
 * @param encantadoId Quem vai vestir. Precisa estar no elenco.
 * @param amuletId Amuleto a vestir. Precisa existir.
 * @returns Estado novo, ou null se o encantado não está no elenco, o amuleto não
 *          existe ou ele já está vestido nesse mesmo encantado.
 *
 * Casos de borda: se outro encantado vestia o amuleto, ele fica sem. Se quem vai
 * vestir já tinha um amuleto, o antigo volta para a mochila, mesmo que ela esteja
 * cheia (o limite da mochila só vale para amuletos que caem).
 */
export function equipAmulet(
  state: GameState,
  encantadoId: string,
  amuletId: string,
): GameState | null {
  const isOwned = encantadoId in state.roster;
  const exists = amuletId in state.amulets;
  const isAlreadyWorn = state.equipped[encantadoId] === amuletId;

  if (!isOwned || !exists || isAlreadyWorn) {
    return null;
  }

  const othersEquipment = Object.entries(state.equipped).filter(
    ([wearerId, equippedId]) => wearerId !== encantadoId && equippedId !== amuletId,
  );

  const equipped = { ...Object.fromEntries(othersEquipment), [encantadoId]: amuletId };
  return { ...state, equipped };
}

// Tira o amuleto de um encantado e devolve para a mochila. Null se ele não vestia nada.
export function unequipAmulet(state: GameState, encantadoId: string): GameState | null {
  if (!(encantadoId in state.equipped)) {
    return null;
  }

  const remaining = Object.entries(state.equipped).filter(([wearerId]) => wearerId !== encantadoId);
  return { ...state, equipped: Object.fromEntries(remaining) };
}


// =============================================================================
// =============================================================================
// D E S M A N C H E

/**
 * Cavacos que o desmanche de um amuleto rende.
 *
 * Fórmula: valor da raridade × (1 + salvageStageBonus × (estágio em que caiu − 1)),
 * mais uma parte (carveRefundRate) dos Cavacos gastos no entalhe dele.
 *
 * @param amulet Amuleto a avaliar.
 * @returns Cavacos, arredondados. Nunca menos que 1.
 */
export function getSalvageValue(amulet: Amulet): number {
  const rarityDef = getAmuletRarity(amulet.rarity);
  const stageMultiplier = 1 + BALANCE.salvageStageBonus * (Math.max(1, amulet.foundAtStage) - 1);
  const refund = getTotalCarveCost(amulet) * BALANCE.carveRefundRate;
  return Math.max(1, Math.round(rarityDef.salvageValue * stageMultiplier + refund));
}

// Desmancha um amuleto da mochila em Cavacos. Null se ele não existe ou está vestido.
export function salvageAmulet(state: GameState, amuletId: string): GameState | null {
  const amulet = state.amulets[amuletId];
  const isWorn = getWearerId(state, amuletId) !== null;

  if (amulet === undefined || isWorn) {
    return null;
  }

  return removeAmulets(state, [amulet]);
}

/**
 * Desmancha de uma vez todos os amuletos da mochila até uma raridade.
 *
 * @param state Estado de partida. Não é alterado.
 * @param maxRarity Raridade mais alta que entra no desmanche.
 * @returns Estado novo, ou null se nenhum amuleto da mochila se encaixa.
 *
 * Caso de borda: amuleto vestido nunca é desmanchado, seja qual for a raridade.
 */
export function salvageBagUpTo(state: GameState, maxRarity: Rarity): GameState | null {
  const targets = getBagAmulets(state).filter(
    (amulet) => compareRarity(amulet.rarity, maxRarity) <= 0,
  );

  return targets.length === 0 ? null : removeAmulets(state, targets);
}

// Liga o desmanche automático até a raridade informada, ou desliga com null
export function setAutoSalvage(state: GameState, maxRarity: Rarity | null): GameState {
  return { ...state, autoSalvage: maxRarity };
}

// Tira os amuletos do estado e soma os Cavacos de cada um
function removeAmulets(state: GameState, targets: readonly Amulet[]): GameState {
  const targetIds = new Set(targets.map((amulet) => amulet.id));
  const kept = Object.entries(state.amulets).filter(([amuletId]) => !targetIds.has(amuletId));
  const gained = targets.reduce((sum, amulet) => sum + getSalvageValue(amulet), 0);

  return { ...state, amulets: Object.fromEntries(kept), shavings: state.shavings + gained };
}


// =============================================================================
// =============================================================================
// E N T A L H E

/**
 * Cavacos que o próximo nível de entalhe de um amuleto custa.
 *
 * Fórmula: carveCostBase × multiplicador da raridade × carveCostGrowth^nível atual.
 *
 * @param amulet Amuleto a entalhar.
 * @returns Custo do próximo nível, arredondado para cima.
 */
export function getCarveCost(amulet: Amulet): number {
  return getCarveCostAtLevel(amulet.rarity, amulet.level);
}

// Diz se o amuleto já chegou ao nível máximo da raridade dele
export function isAmuletMaxed(amulet: Amulet): boolean {
  return amulet.level >= getAmuletRarity(amulet.rarity).maxLevel;
}

// Diz se dá para entalhar agora: amuleto existe, não está no máximo e há Cavacos
export function canCarve(state: GameState, amuletId: string): boolean {
  const amulet = state.amulets[amuletId];

  if (amulet === undefined || isAmuletMaxed(amulet)) {
    return false;
  }

  return state.shavings >= getCarveCost(amulet);
}

/**
 * Entalha um amuleto: gasta Cavacos e sobe um nível, o que fortalece todos os bônus dele.
 *
 * @param state Estado de partida. Não é alterado.
 * @param amuletId Amuleto a entalhar. Pode estar vestido ou na mochila.
 * @returns Estado novo, ou null se o amuleto não existe, já está no nível máximo
 *          da raridade ou faltam Cavacos.
 */
export function carveAmulet(state: GameState, amuletId: string): GameState | null {
  const amulet = state.amulets[amuletId];

  if (amulet === undefined || !canCarve(state, amuletId)) {
    return null;
  }

  const carved: Amulet = { ...amulet, level: amulet.level + 1 };

  return {
    ...state,
    shavings: state.shavings - getCarveCost(amulet),
    amulets: { ...state.amulets, [amuletId]: carved },
  };
}

// Custo de sair de um nível de entalhe para o seguinte
function getCarveCostAtLevel(rarity: Rarity, level: number): number {
  const rarityMultiplier = getAmuletRarity(rarity).carveCostMultiplier;
  const growth = Math.pow(BALANCE.carveCostGrowth, level);
  return Math.ceil(BALANCE.carveCostBase * rarityMultiplier * growth);
}

// Soma dos Cavacos já gastos para trazer o amuleto ao nível atual
function getTotalCarveCost(amulet: Amulet): number {
  let total = 0;

  for (let level = 0; level < amulet.level; level += 1) {
    total += getCarveCostAtLevel(amulet.rarity, level);
  }

  return total;
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S

/**
 * Compara duas raridades pela ordem da tabela AMULET_RARITIES.
 *
 * @returns Negativo se a primeira é mais comum, zero se são iguais, positivo se é mais rara.
 */
export function compareRarity(first: Rarity, second: Rarity): number {
  return RARITY_ORDER.indexOf(first) - RARITY_ORDER.indexOf(second);
}

// Quatro casas decimais bastam para um bônus e deixam o salvamento menor
function roundBonus(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
