/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/juazeiro.ts
 * O que faz: a árvore de talentos da Rebrota. São três galhos (Força, Vento e
 * Lua), cada um com nós que se compram com Raízes livres.
 *
 * Custo do próximo nível de um nó = costBase + costStep × nível atual.
 * Exemplo: costBase 2 e costStep 2 custam 2, 4, 6...
 *
 * Gastar Raízes não tira o bônus passivo delas (+5% de dano e de Patacas por
 * Raiz fincada). A regra está em src/domain/juazeiro.ts.
 *
 * Mapa:
 *   1. Galhos
 *   2. Nós
 */

import type { JuazeiroBranchDef, JuazeiroNodeDef } from '../domain/types';

// =============================================================================
// =============================================================================
// G A L H O S

export const JUAZEIRO_BRANCHES: readonly JuazeiroBranchDef[] = [
  {
    id: 'forca',
    name: 'Galho da Força',
    description: 'Dano, chefes e crítico.',
  },
  {
    id: 'vento',
    name: 'Galho do Vento',
    description: 'Começar mais adiante e render mais sem você por perto.',
  },
  {
    id: 'lua',
    name: 'Galho da Lua',
    description: 'Rastros, Oferendas e amuletos.',
  },
];


// =============================================================================
// =============================================================================
// N Ó S

export const JUAZEIRO_NODES: readonly JuazeiroNodeDef[] = [
  // Força
  {
    id: 'cerne-duro',
    branch: 'forca',
    name: 'Cerne duro',
    description: '+15% de dano por nível.',
    effect: 'damage',
    valuePerLevel: 0.15,
    maxLevel: 10,
    costBase: 1,
    costStep: 1,
  },
  {
    id: 'espinho-velho',
    branch: 'forca',
    name: 'Espinho velho',
    description: '+20% de dano contra chefes por nível.',
    effect: 'bossDamage',
    valuePerLevel: 0.2,
    maxLevel: 5,
    costBase: 2,
    costStep: 2,
  },
  {
    id: 'folego-de-vaqueiro',
    branch: 'forca',
    name: 'Fôlego de vaqueiro',
    description: '+3 segundos no tempo do chefe por nível.',
    effect: 'bossTime',
    valuePerLevel: 3,
    maxLevel: 5,
    costBase: 3,
    costStep: 2,
  },
  {
    id: 'golpe-de-facao',
    branch: 'forca',
    name: 'Golpe de facão',
    description: '+3% de chance de crítico por nível.',
    effect: 'critChance',
    valuePerLevel: 0.03,
    maxLevel: 5,
    costBase: 4,
    costStep: 2,
  },

  // Vento
  {
    id: 'atalho-da-trilha',
    branch: 'vento',
    name: 'Atalho da trilha',
    description: 'Cada edição começa 5 estágios à frente por nível.',
    effect: 'startStage',
    valuePerLevel: 5,
    maxLevel: 4,
    costBase: 3,
    costStep: 3,
  },
  {
    id: 'bolsa-herdada',
    branch: 'vento',
    name: 'Bolsa herdada',
    description: 'Cada edição começa com as Patacas de 40 visagens por nível.',
    effect: 'startGold',
    valuePerLevel: 1,
    maxLevel: 3,
    costBase: 2,
    costStep: 2,
  },
  {
    id: 'mao-ligeira',
    branch: 'vento',
    name: 'Mão ligeira',
    description: 'Libera a compra automática de melhorias, que você liga e desliga.',
    effect: 'autoBuy',
    valuePerLevel: 1,
    maxLevel: 1,
    costBase: 8,
    costStep: 0,
  },
  {
    id: 'rede-de-dormir',
    branch: 'vento',
    name: 'Rede de dormir',
    description: 'A ausência rende 10% a mais por nível (começa em 50%).',
    effect: 'offlineEfficiency',
    valuePerLevel: 0.1,
    maxLevel: 3,
    costBase: 4,
    costStep: 4,
  },
  {
    id: 'noite-comprida',
    branch: 'vento',
    name: 'Noite comprida',
    description: '+2 horas no teto da ausência por nível (começa em 8 horas).',
    effect: 'offlineCap',
    valuePerLevel: 7200, // 2 horas, em segundos
    maxLevel: 2,
    costBase: 6,
    costStep: 6,
  },

  // Lua
  {
    id: 'faro-de-mateiro',
    branch: 'lua',
    name: 'Faro de mateiro',
    description: '+25% de chance de Rastro por nível.',
    effect: 'trailChance',
    valuePerLevel: 0.25,
    maxLevel: 4,
    costBase: 2,
    costStep: 2,
  },
  {
    id: 'mao-de-rezadeira',
    branch: 'lua',
    name: 'Mão de rezadeira',
    description: '+25% de chance de Oferenda por nível.',
    effect: 'itemChance',
    valuePerLevel: 0.25,
    maxLevel: 4,
    costBase: 2,
    costStep: 2,
  },
  {
    id: 'patua',
    branch: 'lua',
    name: 'Patuá',
    description: '+20% de chance de amuleto por nível.',
    effect: 'amuletChance',
    valuePerLevel: 0.2,
    maxLevel: 5,
    costBase: 3,
    costStep: 2,
  },
  {
    id: 'bornal-fundo',
    branch: 'lua',
    name: 'Bornal fundo',
    description: '+10 vagas na mochila de amuletos por nível.',
    effect: 'bagSize',
    valuePerLevel: 10,
    maxLevel: 3,
    costBase: 3,
    costStep: 3,
  },
];
