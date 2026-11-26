/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/formulas.ts
 * O que faz: todas as contas de balanceamento. São funções puras: recebem
 * números, devolvem números e não alteram nada. As constantes vêm de
 * src/data/balance.ts.
 *
 * Mapa:
 *   1. Visagens e recompensas
 *   2. Encantados
 *   3. Melhorias
 *   4. Rebrota
 *   5. Expedições
 *   6. Ferramentas
 */

import { BALANCE } from '../data/balance';
import type { EncantadoDef, EnemyDef, Modifiers, UpgradeDef } from './types';

// =============================================================================
// =============================================================================
// V I S A G E N S   E   R E C O M P E N S A S

/**
 * Vida máxima de um inimigo.
 *
 * Fórmula: enemyBaseHp × enemyHpGrowth^(estágio − 1) × hpMultiplier do inimigo,
 * vezes bossHpMultiplier quando é chefe.
 *
 * @param stage Estágio em que o inimigo aparece, a partir de 1.
 * @param enemy Definição do inimigo.
 * @param isBoss Se ele entra como chefe do estágio.
 * @returns Vida máxima, arredondada para cima. Nunca menor que 1.
 */
export function getEnemyMaxHp(stage: number, enemy: EnemyDef, isBoss: boolean): number {
  const baseHp = growByStage(BALANCE.enemyBaseHp, BALANCE.enemyHpGrowth, stage);
  const bossMultiplier = isBoss ? BALANCE.bossHpMultiplier : 1;
  return Math.max(1, Math.ceil(baseHp * enemy.hpMultiplier * bossMultiplier));
}

/**
 * Patacas que um inimigo derrotado entrega.
 *
 * Fórmula: goldBase × goldGrowth^(estágio − 1) × goldMultiplier do inimigo ×
 * multiplicador de Patacas da comitiva, vezes bossGoldMultiplier quando é chefe.
 *
 * @param stage Estágio do inimigo, a partir de 1.
 * @param enemy Definição do inimigo.
 * @param isBoss Se ele era o chefe do estágio.
 * @param goldMultiplier Multiplicador vindo de melhorias, sinergias e Raízes.
 * @returns Patacas, arredondadas. Nunca menos que 1, para toda derrota render algo.
 */
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

/**
 * Dano de um golpe, antes do crítico.
 *
 * Fórmula: ataque base × (1 + damagePerLevel × nível) × multiplicador de dano,
 * vezes o multiplicador de dano em chefes quando o alvo é um chefe.
 *
 * @param encantado Definição de quem ataca.
 * @param level Nível atual de quem ataca, a partir de 1.
 * @param modifiers Multiplicadores da comitiva (melhorias, sinergias e Raízes).
 * @param isBoss Se o alvo é o chefe do estágio.
 * @returns Dano do golpe. O crítico é aplicado por quem chama.
 */
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

// Custo do próximo nível = baseCost × costFactor^nível, arredondado para cima
export function getUpgradeCost(upgrade: UpgradeDef, level: number): number {
  return Math.ceil(upgrade.baseCost * Math.pow(upgrade.costFactor, level));
}

// Diz se a melhoria já chegou ao nível máximo. Melhoria sem maxLevel nunca chega.
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
// E X P E D I Ç Õ E S

/**
 * Dano de uma encostada de visagem na personagem, durante a expedição.
 *
 * Fórmula: enemyDamageBase × enemyDamageGrowth^(nível − 1) × hpMultiplier da visagem.
 * Visagem com mais vida (hpMultiplier maior) também bate mais forte.
 *
 * @param level Nível da visagem, a partir de 1.
 * @param enemy Definição da visagem.
 * @returns Dano, arredondado para cima, no mínimo 1.
 */
export function getEnemyContactDamage(level: number, enemy: EnemyDef): number {
  const base = growByStage(BALANCE.enemyDamageBase, BALANCE.enemyDamageGrowth, level);
  return Math.max(1, Math.ceil(base * enemy.hpMultiplier));
}

// Vida da personagem na expedição: playerBaseHp × (1 + playerHpPerLevel × (nível − 1))
export function getExpeditionMaxHp(level: number): number {
  return Math.round(BALANCE.playerBaseHp * (1 + BALANCE.playerHpPerLevel * (level - 1)));
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S

// Crescimento exponencial por estágio: base × fator^(estágio − 1)
function growByStage(base: number, growth: number, stage: number): number {
  return base * Math.pow(growth, stage - 1);
}
