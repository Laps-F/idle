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
 *   - Rastros: não vêm das visagens. Vêm das pegadas pegas no chão
 *     (src/domain/expeditionFootprints.ts), guardadas na bolsa e entregues aqui,
 *     sem passar do que o pacto pede.
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

import { getEnemy, getExpeditionLoot } from './catalog';
import { getGoldReward, getXpReward } from './formulas';
import {
  createRewardContext,
  getCurrentModifiers,
  grantKill,
  grantTrail,
  isTrailStillNeeded,
  rollAmulet,
  rollItemDrops,
  runAutoBuy,
  toResult,
} from './rewards';
import type { RewardContext, SimulationOptions } from './rewards';
import { createEmptySummary } from './state';
import type { ExpeditionLootDef, GameState, MapKill, SimulationResult } from './types';

// =============================================================================
// =============================================================================
// E N T R E G A   D A   B O L S A

// O que a bolsa entrega: as visagens (com as de bônus) e os Rastros das pegadas
export interface ExpeditionBag {
  mapId: string;
  kills: readonly MapKill[];
  trails: Readonly<Record<string, number>>;
}

/**
 * Entrega a bolsa de uma expedição: as visagens pela tabela de saque do mapa e
 * os Rastros das pegadas.
 *
 * Função pura: não altera "state". Não mexe no combate de estágios, no estágio
 * atual nem na contagem até o chefe.
 *
 * @param state Estado de partida. Não é alterado.
 * @param bag Mapa (precisa ter saque em src/data/expeditionLoot.ts), visagens na
 *            ordem em que caíram (com as de bônus, se houver) e Rastros por encantado.
 * @param options Instante da entrega e sorteio.
 * @returns Estado novo, resumo do que rendeu e os eventos (se pedidos).
 * @throws Error se o mapa não tiver saque (o teste de dados impede).
 *
 * Casos de borda: bolsa vazia devolve o mesmo "state" recebido, com o resumo
 * zerado. Rastro de quem já fechou o pacto ou já juntou o bastante não é
 * entregue. Todas as visagens usam o mesmo instante.
 */
export function rewardExpeditionBag(
  state: GameState,
  bag: ExpeditionBag,
  options: SimulationOptions,
): SimulationResult {
  const hasTrails = Object.values(bag.trails).some((amount) => amount > 0);

  if (bag.kills.length === 0 && !hasTrails) {
    return { state, summary: createEmptySummary(), events: [] };
  }

  const loot = getExpeditionLoot(bag.mapId);
  const context = createRewardContext(state, options);

  for (const kill of bag.kills) {
    grantExpeditionKill(context, loot, kill);
  }
  grantBagTrails(context, bag.trails);

  return toResult(context);
}

// Os Rastros das pegadas, um por um, sem passar do que o pacto pede
function grantBagTrails(context: RewardContext, trails: Readonly<Record<string, number>>): void {
  for (const [encantadoId, amount] of Object.entries(trails)) {
    for (let count = 0; count < amount; count += 1) {
      if (isTrailStillNeeded(context.draft, encantadoId)) {
        grantTrail(context, encantadoId);
      }
    }
  }
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
  rollAmulet(context, kill.stage, false, modifiers, loot.amuletChance);
  runAutoBuy(context);
}
