/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/engine/formulas.ts
 * O que faz: todas as contas de balanceamento. São funções puras: recebem
 * números, devolvem números e não alteram nada.
 *
 * Mapa:
 *   1. Visagens e recompensas
 *   2. Encantados
 *   3. Melhorias
 *   4. Rebrota
 *   5. Ferramentas
 */

import { BALANCE } from '../data/balance';
import type { EncantadoDef, EnemyDef, Modifiers, UpgradeDef } from '../types/game';

// =============================================================================
// =============================================================================
// V I S A G E N S   E   R E C O M P E N S A S

// Vida = enemyBaseHp × enemyHpGrowth^(estágio − 1) × multiplicadores
export function getEnemyMaxHp(stage: number, enemy: EnemyDef, isBoss: boolean): number {
  const baseHp = growByStage(BALANCE.enemyBaseHp, BALANCE.enemyHpGrowth, stage);
  const bossMultiplier = isBoss ? BALANCE.bossHpMultiplier : 1;
  return Math.ceil(baseHp * enemy.hpMultiplier * bossMultiplier);
}

// Patacas = goldBase × goldGrowth^(estágio − 1) × multiplicadores. Nunca menos que 1.
export function getGoldReward(
  stage: number,
  enemy: EnemyDef,
  isBoss: boolean,
  goldMultiplier: number,
): number {
  const baseGold = growByStage(BALANCE.goldBase, BALANCE.goldGrowth, stage);
  const bossMultiplier = isBoss ? BALANCE.bossGoldMultiplier : 1;
  const gold = baseGold * enemy.goldMultiplier * bossMultiplier * goldMultiplier;
  return Math.max(1, Math.round(gold));
}

// XP = xpBase × xpGrowth^(estágio − 1) × multiplicadores. Nunca menos que 1.
export function getXpReward(stage: number, enemy: EnemyDef, isBoss: boolean): number {
  const baseXp = growByStage(BALANCE.xpBase, BALANCE.xpGrowth, stage);
  const bossMultiplier = isBoss ? BALANCE.bossXpMultiplier : 1;
  return Math.max(1, Math.round(baseXp * enemy.xpMultiplier * bossMultiplier));
}


// =============================================================================
// =============================================================================
// E N C A N T A D O S

// XP para sair do nível informado = xpToLevelBase × nível^xpToLevelExponent
export function getXpToNextLevel(level: number): number {
  return Math.round(BALANCE.xpToLevelBase * Math.pow(level, BALANCE.xpToLevelExponent));
}

// Dano de um golpe, sem crítico = ataque base × (1 + damagePerLevel × nível) × multiplicadores
export function getAttackDamage(
  encantado: EncantadoDef,
  level: number,
  modifiers: Modifiers,
  isBoss: boolean,
): number {
  const levelMultiplier = 1 + BALANCE.damagePerLevel * level;
  const bossMultiplier = isBoss ? modifiers.bossDamage : 1;
  return encantado.baseAttack * levelMultiplier * modifiers.damage * bossMultiplier;
}

// Segundos entre dois golpes, já com a velocidade de ataque
export function getAttackInterval(encantado: EncantadoDef, modifiers: Modifiers): number {
  return encantado.attackInterval / modifiers.attackSpeed;
}


// =============================================================================
// =============================================================================
// M E L H O R I A S

// Custo do próximo nível = baseCost × costFactor^nível
export function getUpgradeCost(upgrade: UpgradeDef, level: number): number {
  return Math.ceil(upgrade.baseCost * Math.pow(upgrade.costFactor, level));
}

// Diz se a melhoria já chegou ao nível máximo
export function isUpgradeMaxed(upgrade: UpgradeDef, level: number): boolean {
  return upgrade.maxLevel !== undefined && level >= upgrade.maxLevel;
}


// =============================================================================
// =============================================================================
// R E B R O T A

// Multiplicador permanente de dano e de Patacas = 1 + rootsBonusPerRoot × Raízes
export function getRootsMultiplier(roots: number): number {
  return 1 + BALANCE.rootsBonusPerRoot * roots;
}

// Raízes ganhas na Rebrota = piso((maior estágio ÷ rootsStageDivisor)^rootsExponent)
export function getRootsForRebrota(maxStage: number): number {
  const stageRatio = maxStage / BALANCE.rootsStageDivisor;
  return Math.floor(Math.pow(stageRatio, BALANCE.rootsExponent));
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S

// Crescimento exponencial por estágio: base × fator^(estágio − 1)
function growByStage(base: number, growth: number, stage: number): number {
  return base * Math.pow(growth, stage - 1);
}
