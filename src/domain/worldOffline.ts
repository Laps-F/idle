/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/worldOffline.ts
 * O que faz: calcula o que a personagem conquistou no mapa enquanto o jogo
 * estava fechado. É a "segunda simulação" do mundo aberto: em vez de andar
 * passo a passo, estima quantas visagens a personagem derrota por segundo no
 * mapa onde ficou e entrega as recompensas dessas derrotas. Funções puras.
 *
 * O teto e a eficiência são os mesmos da ausência do combate de estágios
 * (getOfflineRules, com os bônus do juazeiro). O relatório tem o mesmo
 * formato, então a janela de "bem-vindo de volta" serve para os dois.
 *
 * Mapa:
 *   1. Ritmo do mapa
 *   2. Progresso offline
 */

import { BALANCE, MS_PER_SECOND } from '../data/balance';
import { pickRandom } from '../utils/random';
import type { RandomSource } from '../utils/random';
import { getEnemy, getWorldMap, hasWorldMap } from './catalog';
import { getEnemyMaxHp } from './formulas';
import { getOfflineRules } from './juazeiro';
import { getOfflineSimulatedSeconds } from './offline';
import { rewardKills } from './simulation';
import type { GameState, OfflineResult, WorldKill, WorldMapDef } from './types';
import { getWorldFighter } from './world';

// =============================================================================
// =============================================================================
// R I T M O   D O   M A P A

/**
 * Quantas visagens por segundo a personagem derrota sozinha num mapa.
 *
 * Fórmula: 1 ÷ (golpes por visagem × intervalo entre golpes + worldAfkWalkSeconds).
 * Golpes por visagem = vida média das visagens do mapa ÷ dano médio de um golpe,
 * arredondado para cima. O dano médio já conta o crítico pela chance dele.
 *
 * @param state Estado do jogo (comitiva, níveis e bônus).
 * @param map Mapa onde a personagem ficou.
 * @param timestamp Instante em ms. Decide se valem as sinergias de dia ou de noite.
 * @returns Visagens por segundo. Zero sem comitiva.
 */
export function getAfkKillsPerSecond(
  state: GameState,
  map: WorldMapDef,
  timestamp: number,
): number {
  const fighter = getWorldFighter(state, timestamp);

  if (fighter === null) {
    return 0;
  }

  const critBonus = fighter.critChance * (BALANCE.critMultiplier - 1);
  const averageDamage = fighter.damage * (1 + critBonus);
  const hitsPerKill = Math.max(1, Math.ceil(getAverageEnemyHp(map) / averageDamage));
  const secondsPerKill = hitsPerKill * fighter.attackInterval + BALANCE.worldAfkWalkSeconds;
  return 1 / secondsPerKill;
}

// Vida média das visagens que aparecem no mapa
function getAverageEnemyHp(map: WorldMapDef): number {
  const totalHp = map.enemyIds
    .map((enemyId) => getEnemyMaxHp(map.level, getEnemy(enemyId), false))
    .reduce((sum, hp) => sum + hp, 0);
  return totalHp / Math.max(1, map.enemyIds.length);
}


// =============================================================================
// =============================================================================
// P R O G R E S S O   O F F L I N E

/**
 * Calcula o progresso no mapa durante o tempo em que o jogo ficou fechado.
 *
 * O tempo ausente (de state.lastSaveTimestamp até "now") passa pelo teto e pela
 * eficiência (getOfflineSimulatedSeconds). Esse tempo vezes o ritmo do mapa dá
 * o número de visagens derrotadas, que é arredondado para baixo. As visagens
 * são sorteadas entre as do mapa e as recompensas saem de rewardKills.
 *
 * Função pura: não altera "state".
 *
 * @param state Estado salvo antes da ausência. Não é alterado.
 * @param now Instante atual em milissegundos.
 * @param random Fonte de sorteio (qual visagem caiu e as quedas de cada uma).
 * @returns Estado novo, com a marca de tempo em "now", e o relatório da ausência.
 *
 * Casos de borda:
 * - Sem comitiva, ou "now" anterior à marca de tempo: nada rende. Relatório null.
 * - Mapa salvo que não existe mais: nada rende. Relatório null.
 * - O número de derrotas é limitado a worldOfflineMaxKills, para a conta não travar.
 * - Todas as derrotas usam o instante em que a ausência começou (dia, noite e lua
 *   dos Rastros). O ritmo também é calculado uma vez só: subir de nível durante a
 *   ausência não acelera o resto dela.
 */
export function applyWorldOfflineProgress(
  state: GameState,
  now: number,
  random: RandomSource,
): OfflineResult {
  const startTimestamp = state.lastSaveTimestamp;
  const secondsAway = (now - startTimestamp) / MS_PER_SECOND;
  const canEarn = state.party.length > 0 && secondsAway > 0 && hasWorldMap(state.world.mapId);

  if (!canEarn) {
    return { state: { ...state, lastSaveTimestamp: now }, report: null };
  }

  const map = getWorldMap(state.world.mapId);
  const rules = getOfflineRules(state);
  const secondsSimulated = getOfflineSimulatedSeconds(secondsAway, rules);
  const killsPerSecond = getAfkKillsPerSecond(state, map, startTimestamp);
  const killCount = Math.min(
    Math.floor(secondsSimulated * killsPerSecond),
    BALANCE.worldOfflineMaxKills,
  );
  const kills = rollOfflineKills(map, killCount, random);
  const result = rewardKills(state, kills, { startTimestamp, random });
  const stats = result.state.stats;

  return {
    state: {
      ...result.state,
      editionSeconds: result.state.editionSeconds + secondsSimulated,
      stats: { ...stats, playTimeSeconds: stats.playTimeSeconds + secondsSimulated },
      lastSaveTimestamp: now,
    },
    report: {
      secondsAway,
      secondsSimulated,
      capSeconds: rules.capSeconds,
      efficiency: rules.efficiency,
      summary: { ...result.summary, seconds: secondsSimulated },
    },
  };
}

// Sorteia qual visagem do mapa caiu em cada uma das derrotas da ausência
function rollOfflineKills(map: WorldMapDef, count: number, random: RandomSource): WorldKill[] {
  return Array.from({ length: count }, () => ({
    enemyId: pickRandom(map.enemyIds, random),
    stage: map.level,
    zoneId: map.zoneId,
  }));
}
