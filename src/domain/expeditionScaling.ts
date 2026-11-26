/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionScaling.ts
 * O que faz: a escala da expedição. Diz em que nível as visagens de um mapa
 * nascem e quanto cada encostada tira da personagem.
 *
 * Regras (decididas em 26/11/2026, Caminho 1):
 *   - O nível acompanha o poder de quem sai, e não o estágio da clareira. O
 *     nível de partida é aquele em que uma visagem comum aguenta cerca de
 *     expeditionHitsPerEnemy golpes do encantado. Assim melhorias, amuletos,
 *     sinergias, Raízes e o nível do encantado continuam valendo, também
 *     depois da Rebrota.
 *   - Cada mapa soma o seu levelBonus (o Brejo Escuro é mais difícil que a
 *     Beira da Mata), e as ondas sobem um nível a cada waveLevelUpSeconds.
 *   - A encostada tira uma fração da vida máxima, que cresce com os níveis
 *     acima do nível de partida. Por isso a vida maior de um encantado mais
 *     forte não deixa a expedição mais fácil: a resistência vai vir dos
 *     preparos e, depois, da esquiva e das bênçãos.
 *
 * Funções puras, sem estado.
 *
 * Mapa:
 *   1. Nível
 *   2. Dano da encostada
 */

import { BALANCE } from '../data/balance';
import type { EnemyDef, ExpeditionMapDef } from './types';

// Folga para o arredondamento do logaritmo não perder um nível exato
const LEVEL_EPSILON = 1e-9;

// =============================================================================
// =============================================================================
// N Í V E L

/**
 * Nível de partida de quem sai em expedição, pelo dano do golpe comum.
 *
 * Fórmula: é o maior nível L em que a vida de uma visagem comum
 * (enemyBaseHp × enemyHpGrowth^(L − 1)) cabe em expeditionHitsPerEnemy golpes:
 *   L = 1 + piso(log(golpes × dano ÷ enemyBaseHp) ÷ log(enemyHpGrowth))
 * Como o nível é inteiro, a visagem de multiplicador de vida 1 aguenta entre
 * golpes ÷ enemyHpGrowth e golpes acertos.
 *
 * @param damage Dano de um golpe comum de quem sai (ExpeditionFighter.damage).
 * @returns Nível de partida, no mínimo 1.
 *
 * Casos de borda: dano zero, negativo ou que não é número dá nível 1. Dano
 * fraco demais para o nível 1 também dá nível 1.
 */
export function getFighterBaseLevel(damage: number): number {
  const reachableHp = BALANCE.expeditionHitsPerEnemy * damage;

  if (!(reachableHp > BALANCE.enemyBaseHp)) {
    return 1;
  }

  const ratio = reachableHp / BALANCE.enemyBaseHp;
  const levelsAbove = Math.log(ratio) / Math.log(BALANCE.enemyHpGrowth);
  return 1 + Math.floor(levelsAbove + LEVEL_EPSILON);
}

// Nível das visagens no começo de um mapa: o de partida mais o bônus do mapa
export function getMapStartLevel(baseLevel: number, map: ExpeditionMapDef): number {
  return Math.max(1, baseLevel + map.levelBonus);
}

// Nível das visagens que nascem em certo momento: sobe um a cada waveLevelUpSeconds
export function getWaveLevel(
  baseLevel: number,
  map: ExpeditionMapDef,
  elapsedSeconds: number,
): number {
  const levelsFromTime = Math.floor(elapsedSeconds / BALANCE.waveLevelUpSeconds);
  return getMapStartLevel(baseLevel, map) + Math.max(0, levelsFromTime);
}


// =============================================================================
// =============================================================================
// D A N O   D A   E N C O S T A D A

/**
 * Quanto uma visagem tira da personagem a cada encostada.
 *
 * Fórmula: vida máxima × enemyContactHpFraction
 *          × enemyContactGrowth^(nível da visagem − nível de partida)
 *          × multiplicador de vida da visagem,
 * arredondado para cima, no mínimo 1.
 *
 * @param maxHp Vida máxima da personagem.
 * @param level Nível da visagem.
 * @param baseLevel Nível de partida de quem saiu (getFighterBaseLevel).
 * @param enemy A visagem. Visagem de mais vida também bate mais forte.
 * @returns Dano de uma encostada.
 *
 * Caso de borda: visagem abaixo do nível de partida (não acontece no jogo) bate
 * como se estivesse no nível de partida.
 */
export function getEnemyContactDamage(
  maxHp: number,
  level: number,
  baseLevel: number,
  enemy: EnemyDef,
): number {
  const levelsAbove = Math.max(0, level - baseLevel);
  const fraction =
    BALANCE.enemyContactHpFraction * Math.pow(BALANCE.enemyContactGrowth, levelsAbove);
  return Math.max(1, Math.ceil(maxHp * fraction * enemy.hpMultiplier));
}
