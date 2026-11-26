/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionLoot.ts
 * O que faz: transforma a bolsa da expedição em recompensas, pela tabela de
 * saque do mapa (src/data/expeditionLoot.ts). É o saque próprio da expedição,
 * separado das quedas da clareira.
 *
 * O que cada visagem da bolsa rende:
 *   - Patacas: fórmula da clareira no nível da visagem × goldMultiplier do mapa
 *     (com a Bolsa de couro, sinergias, amuletos e Raízes, como na clareira).
 *   - XP para toda a comitiva: fórmula da clareira no nível da visagem ×
 *     xpMultiplier do mapa.
 *   - Oferendas: a tabela "drops" do mapa, para qualquer visagem.
 *   - Amuleto: a chance "amuletChance" do mapa, com a força do nível da visagem.
 *   - Rastros: por enquanto, pelas regras da clareira, na zona do mapa. Na
 *     Etapa 4 do Caminho 1 eles passam a vir das pegadas no chão.
 *   - A compra automática de melhorias roda depois de cada visagem.
 *
 * As peças de recompensa (Patacas, XP e nível, Oferenda, Rastro, amuleto) são
 * as de src/domain/rewards.ts, as mesmas da clareira.
 *
 * Função pura: não altera o estado recebido.
 *
 * Mapa:
 *   1. Entrega da bolsa
 */

import { getEnemy, getExpeditionLoot, getZone } from './catalog';
import { getGoldReward, getXpReward } from './formulas';
import {
  createRewardContext,
  getCurrentModifiers,
  grantKill,
  rollAmulet,
  rollItemDrops,
  rollTrails,
  runAutoBuy,
  toResult,
} from './rewards';
import type { RewardContext, SimulationOptions } from './rewards';
import { createEmptySummary } from './state';
import type { ExpeditionLootDef, GameState, MapKill, SimulationResult } from './types';

// =============================================================================
// =============================================================================
// E N T R E G A   D A   B O L S A

/**
 * Entrega as visagens da bolsa de uma expedição pela tabela de saque do mapa.
 *
 * Função pura: não altera "state". Não mexe no combate de estágios, no estágio
 * atual nem na contagem até o chefe.
 *
 * @param state Estado de partida. Não é alterado.
 * @param mapId Mapa da expedição. Precisa ter saque em src/data/expeditionLoot.ts.
 * @param kills Visagens derrotadas, na ordem em que caíram (com as de bônus, se houver).
 * @param options Instante da entrega (decide dia, noite e lua dos Rastros) e sorteio.
 * @returns Estado novo, resumo do que rendeu e os eventos (se pedidos).
 * @throws Error se o mapa não tiver saque (o teste de dados impede).
 *
 * Casos de borda: lista vazia devolve o mesmo "state" recebido, com o resumo
 * zerado. Todas as visagens da lista usam o mesmo instante.
 */
export function rewardExpeditionKills(
  state: GameState,
  mapId: string,
  kills: readonly MapKill[],
  options: SimulationOptions,
): SimulationResult {
  if (kills.length === 0) {
    return { state, summary: createEmptySummary(), events: [] };
  }

  const loot = getExpeditionLoot(mapId);
  const context = createRewardContext(state, options);

  for (const kill of kills) {
    grantExpeditionKill(context, loot, kill);
  }

  return toResult(context);
}

// Tudo que uma visagem da bolsa rende, na ordem descrita no cabeçalho
function grantExpeditionKill(
  context: RewardContext,
  loot: ExpeditionLootDef,
  kill: MapKill,
): void {
  const modifiers = getCurrentModifiers(context);
  const enemy = getEnemy(kill.enemyId);
  const gold = getGoldReward(kill.stage, enemy, false, modifiers.gold) * loot.goldMultiplier;
  const xp = getXpReward(kill.stage, enemy, false) * loot.xpMultiplier;

  grantKill(context, enemy.id, false, gold, xp);
  rollItemDrops(context, loot.drops, modifiers);
  rollTrails(context, getZone(kill.zoneId), modifiers);
  rollAmulet(context, kill.stage, false, modifiers, loot.amuletChance);
  runAutoBuy(context);
}
