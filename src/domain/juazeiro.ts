/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/juazeiro.ts
 * O que faz: regras do juazeiro, a árvore de talentos da Rebrota. Diz quanto
 * custa cada nó, quantas Raízes estão livres, compra um nó e traduz os nós
 * comprados nos bônus que o resto do jogo usa (tempo do chefe, mochila,
 * ausência, dano, chances).
 *
 * Duas contas, uma moeda: "roots" no estado são as Raízes fincadas (todas as
 * já ganhas). As livres são as fincadas menos o que já foi gasto nos nós.
 * Gastar não tira o bônus passivo das Raízes, que conta as fincadas.
 *
 * Módulo puro: não conhece a store nem o React. As ações recebem o estado e
 * devolvem um estado novo, ou null quando não são permitidas.
 *
 * Mapa:
 *   1. Custos e Raízes livres
 *   2. Compra de nós
 *   3. Bônus em vigor
 *   4. Regras que dependem do juazeiro
 */

import { BALANCE } from '../data/balance';
import { JUAZEIRO_NODES } from '../data/juazeiro';
import { getJuazeiroNode, getZoneForStage, hasJuazeiroNode } from './catalog';
import type { GameState, JuazeiroEffect, JuazeiroNodeDef } from './types';

// Regras da ausência que valem para um estado
export interface OfflineRules {
  capSeconds: number; // teto do tempo fora que rende
  efficiency: number; // parte do tempo que rende, de 0 a 1
}

// Bônus somados de todos os nós, por efeito
export type JuazeiroBonuses = Record<JuazeiroEffect, number>;

const MAX_OFFLINE_EFFICIENCY = 1;

// =============================================================================
// =============================================================================
// C U S T O S   E   R A Í Z E S   L I V R E S

// Nível atual de um nó (0 se nunca foi comprado)
export function getNodeLevel(levels: Record<string, number>, nodeId: string): number {
  return levels[nodeId] ?? 0;
}

// Raízes do próximo nível de um nó: costBase + costStep × nível atual
export function getNodeCost(node: JuazeiroNodeDef, level: number): number {
  return node.costBase + node.costStep * level;
}

// Diz se o nó já está no nível máximo
export function isNodeMaxed(node: JuazeiroNodeDef, level: number): boolean {
  return level >= node.maxLevel;
}

/**
 * Soma as Raízes gastas em todos os nós comprados.
 *
 * @param levels Nível de cada nó. Id desconhecido é ignorado.
 * @returns Total gasto: para cada nó, a soma dos custos dos níveis já comprados.
 */
export function getSpentRoots(levels: Record<string, number>): number {
  let spent = 0;

  for (const node of JUAZEIRO_NODES) {
    const level = Math.min(getNodeLevel(levels, node.id), node.maxLevel);

    for (let bought = 0; bought < level; bought += 1) {
      spent += getNodeCost(node, bought);
    }
  }

  return spent;
}

// Raízes livres = fincadas − gastas. Nunca negativo.
export function getFreeRoots(state: GameState): number {
  return Math.max(0, state.roots - getSpentRoots(state.juazeiro));
}


// =============================================================================
// =============================================================================
// C O M P R A   D E   N Ó S

// Diz se dá para comprar o próximo nível do nó agora
export function canBuyNode(state: GameState, nodeId: string): boolean {
  if (!hasJuazeiroNode(nodeId)) {
    return false;
  }

  const node = getJuazeiroNode(nodeId);
  const level = getNodeLevel(state.juazeiro, nodeId);
  return !isNodeMaxed(node, level) && getFreeRoots(state) >= getNodeCost(node, level);
}

/**
 * Compra o próximo nível de um nó do juazeiro, pagando com Raízes livres.
 *
 * As Raízes fincadas (state.roots) não mudam: o bônus passivo delas continua.
 * O que diminui são as livres, que são calculadas a partir dos nós comprados.
 *
 * @param state Estado atual. Não é alterado.
 * @param nodeId Id do nó em src/data/juazeiro.ts.
 * @returns Estado com o nó um nível acima, ou null se o nó não existe, já está
 *          no máximo ou faltam Raízes livres.
 *
 * Casos de borda: comprar "Mão ligeira" também liga a compra automática, porque
 * quem paga por ela quer usá-la. A pessoa pode desligar depois.
 */
export function buyJuazeiroNode(state: GameState, nodeId: string): GameState | null {
  if (!canBuyNode(state, nodeId)) {
    return null;
  }

  const node = getJuazeiroNode(nodeId);
  const level = getNodeLevel(state.juazeiro, nodeId);
  const juazeiro = { ...state.juazeiro, [nodeId]: level + 1 };
  const autoBuy = node.effect === 'autoBuy' ? true : state.autoBuy;

  return { ...state, juazeiro, autoBuy };
}


// =============================================================================
// =============================================================================
// B Ô N U S   E M   V I G O R

/**
 * Soma o efeito de todos os nós comprados.
 *
 * @param levels Nível de cada nó. Id desconhecido é ignorado e nível acima do
 *               máximo conta como o máximo.
 * @returns Valor total de cada efeito. Efeito sem nó comprado vale 0.
 */
export function getJuazeiroBonuses(levels: Record<string, number>): JuazeiroBonuses {
  const bonuses = createEmptyJuazeiroBonuses();

  for (const node of JUAZEIRO_NODES) {
    const level = Math.min(getNodeLevel(levels, node.id), node.maxLevel);
    bonuses[node.effect] += node.valuePerLevel * level;
  }

  return bonuses;
}

// Tabela de bônus zerada
function createEmptyJuazeiroBonuses(): JuazeiroBonuses {
  return {
    damage: 0,
    bossDamage: 0,
    critChance: 0,
    bossTime: 0,
    startStage: 0,
    startGold: 0,
    autoBuy: 0,
    offlineEfficiency: 0,
    offlineCap: 0,
    trailChance: 0,
    itemChance: 0,
    amuletChance: 0,
    bagSize: 0,
  };
}


// =============================================================================
// =============================================================================
// R E G R A S   Q U E   D E P E N D E M   D O   J U A Z E I R O

// Segundos para vencer o chefe do estágio: o da zona mais o "Fôlego de vaqueiro"
export function getBossTimeLimit(state: GameState): number {
  const zoneLimit = getZoneForStage(state.stage).bossTimeLimit;
  return zoneLimit + getJuazeiroBonuses(state.juazeiro).bossTime;
}

// Vagas da mochila de amuletos: a base mais o "Bornal fundo"
export function getBagSize(state: GameState): number {
  return BALANCE.amuletBagSize + getJuazeiroBonuses(state.juazeiro).bagSize;
}

// Teto e eficiência da ausência, com "Noite comprida" e "Rede de dormir"
export function getOfflineRules(state: GameState): OfflineRules {
  const bonuses = getJuazeiroBonuses(state.juazeiro);
  const efficiency = BALANCE.offlineEfficiency + bonuses.offlineEfficiency;

  return {
    capSeconds: BALANCE.offlineCapSeconds + bonuses.offlineCap,
    efficiency: Math.min(MAX_OFFLINE_EFFICIENCY, efficiency),
  };
}

// Diz se a compra automática de melhorias está valendo: nó comprado e chave ligada
export function isAutoBuyActive(state: GameState): boolean {
  return state.autoBuy && getJuazeiroBonuses(state.juazeiro).autoBuy > 0;
}

// Diz se a pessoa já tem o nó que libera a compra automática
export function hasAutoBuyNode(state: GameState): boolean {
  return getJuazeiroBonuses(state.juazeiro).autoBuy > 0;
}
