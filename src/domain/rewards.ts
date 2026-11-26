/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/rewards.ts
 * O que faz: as peças de recompensa que a clareira e a expedição usam: Patacas,
 * XP para a comitiva (com subida de nível), Oferendas, Rastros, amuleto e a
 * compra automática de melhorias logo depois de cada ganho.
 *
 * Cada peça entrega uma coisa só. Quem decide quanto entregar e de onde vêm os
 * números é quem chama:
 *   - src/domain/simulation.ts (clareira): grantKillRewards, com as fórmulas
 *     por estágio de src/domain/formulas.ts.
 *   - src/domain/expedition.ts (volta da expedição): rewardKills, por enquanto
 *     com as mesmas regras da clareira e o nível da visagem no lugar do estágio.
 *
 * Como funciona: todas as peças trabalham num contexto (RewardContext) com uma
 * cópia privada do estado, o "draft", e o resumo do que já rendeu. Só o draft
 * e o resumo são alterados. createRewardContext copia o estado e toResult
 * entrega o resultado, então por fora tudo continua puro.
 *
 * Mapa:
 *   1. Tipos
 *   2. Contexto e resultado
 *   3. Recompensa completa de uma derrota
 *   4. Peças de recompensa
 *   5. Entrega da bolsa da expedição
 */

import { randomInteger, rollChance } from '../utils/random';
import type { RandomSource } from '../utils/random';
import { receiveAmulet, rollAmuletDrop } from './amulets';
import { getEncantado, getEnemy, getZone } from './catalog';
import { getDayPhase, matchesClock } from './clock';
import { getGoldReward, getXpReward, getXpToNextLevel } from './formulas';
import { getModifiersByPhase } from './modifiers';
import { autoBuyUpgrades } from './rebrota';
import { cloneGameState, createEmptySummary } from './state';
import type {
  CombatEvent,
  DayPhase,
  DropEntry,
  EnemyDef,
  GameState,
  MapKill,
  Modifiers,
  SimulationResult,
  SimulationSummary,
  ZoneDef,
} from './types';

// =============================================================================
// =============================================================================
// T I P O S

export interface SimulationOptions {
  startTimestamp: number; // instante real (ms) em que o trecho começa
  random: RandomSource; // fonte dos sorteios (crítico, itens, Rastros, próxima visagem)
  clockMsPerSecond?: number; // quanto o relógio real anda por segundo simulado. Padrão: 1000.
  collectEvents?: boolean; // se o resultado deve trazer os eventos. Padrão: false.
}

// Tudo que as peças precisam, para não passar sete parâmetros adiante
export interface RewardContext {
  draft: GameState; // cópia privada do estado. É a única coisa que as peças alteram.
  summary: SimulationSummary;
  events: CombatEvent[];
  collectEvents: boolean;
  random: RandomSource;
  modifiersByPhase: Record<DayPhase, Modifiers>;
  timestamp: number; // instante real correspondente ao ponto atual
}

// De quem são as recompensas: o inimigo, o estágio (ou nível do mapa) e a zona dos Rastros
export interface RewardTarget {
  enemy: EnemyDef;
  stage: number;
  isBoss: boolean;
  zone: ZoneDef;
}


// =============================================================================
// =============================================================================
// C O N T E X T O   E   R E S U L T A D O

// Monta o contexto de trabalho. É aqui que o estado é copiado.
export function createRewardContext(state: GameState, options: SimulationOptions): RewardContext {
  return {
    draft: cloneGameState(state),
    summary: createEmptySummary(),
    events: [],
    collectEvents: options.collectEvents ?? false,
    random: options.random,
    modifiersByPhase: getModifiersByPhase(state),
    timestamp: options.startTimestamp,
  };
}

// Entrega a cópia trabalhada como o estado novo
export function toResult(context: RewardContext): SimulationResult {
  return { state: context.draft, summary: context.summary, events: context.events };
}

// Multiplicadores da fase do dia em que o contexto está
export function getCurrentModifiers(context: RewardContext): Modifiers {
  return context.modifiersByPhase[getDayPhase(context.timestamp)];
}

// Guarda o evento, se quem chamou pediu eventos
export function emit(context: RewardContext, event: CombatEvent): void {
  if (context.collectEvents) {
    context.events.push(event);
  }
}


// =============================================================================
// =============================================================================
// R E C O M P E N S A   C O M P L E T A   D E   U M A   D E R R O T A

// Patacas, XP, Oferendas, Rastros e, com sorte, um amuleto de um inimigo derrotado
export function grantKillRewards(
  context: RewardContext,
  target: RewardTarget,
  modifiers: Modifiers,
): void {
  const { enemy, stage, isBoss } = target;
  const gold = getGoldReward(stage, enemy, isBoss, modifiers.gold);
  const xp = getXpReward(stage, enemy, isBoss);

  grantGold(context, gold);
  context.draft.stats.totalKills += 1;
  context.summary.xp += xp;
  context.summary.kills += 1;
  emit(context, { type: 'kill', enemyId: enemy.id, isBoss, gold, xp });

  grantXpToParty(context, xp);
  rollItemDrops(context, enemy.drops, modifiers);
  rollTrails(context, target.zone, modifiers);
  rollAmulet(context, stage, isBoss, modifiers);
  runAutoBuy(context);
}


// =============================================================================
// =============================================================================
// P E Ç A S   D E   R E C O M P E N S A

// Soma Patacas no saldo, nas estatísticas e no resumo
export function grantGold(context: RewardContext, gold: number): void {
  context.draft.gold += gold;
  context.draft.stats.totalGoldEarned += gold;
  context.summary.gold += gold;
}

// Cada encantado da comitiva recebe o XP inteiro e sobe de nível quando junta o bastante
export function grantXpToParty(context: RewardContext, xp: number): void {
  const { draft, summary } = context;

  for (const encantadoId of draft.party) {
    const owned = draft.roster[encantadoId];

    if (owned === undefined) {
      continue;
    }

    owned.xp += xp;

    while (owned.xp >= getXpToNextLevel(owned.level)) {
      owned.xp -= getXpToNextLevel(owned.level);
      owned.level += 1;
      summary.levelUps[encantadoId] = (summary.levelUps[encantadoId] ?? 0) + 1;
      emit(context, { type: 'levelUp', encantadoId, level: owned.level });
    }
  }
}

// Sorteia cada Oferenda de uma tabela de quedas
export function rollItemDrops(
  context: RewardContext,
  drops: readonly DropEntry[],
  modifiers: Modifiers,
): void {
  const { random } = context;

  for (const drop of drops) {
    const chance = Math.min(1, drop.chance * modifiers.itemChance);

    if (rollChance(chance, random)) {
      grantItem(context, drop.itemId, randomInteger(drop.min, drop.max, random));
    }
  }
}

// Soma uma Oferenda no inventário e no resumo
export function grantItem(context: RewardContext, itemId: string, amount: number): void {
  const { draft, summary } = context;
  draft.inventory[itemId] = (draft.inventory[itemId] ?? 0) + amount;
  summary.items[itemId] = (summary.items[itemId] ?? 0) + amount;
  emit(context, { type: 'drop', itemId, amount });
}

// Sorteia Rastros dos encantados da zona que ainda não entraram na comitiva
export function rollTrails(context: RewardContext, zone: ZoneDef, modifiers: Modifiers): void {
  const { draft, random, timestamp } = context;

  for (const encounter of zone.encounters) {
    const { encantadoId } = encounter;
    const chance = Math.min(1, encounter.trailChance * modifiers.trailChance);
    const isClockRight = matchesClock(encounter, timestamp);
    const canFindTrail = isClockRight && isTrailStillNeeded(draft, encantadoId);

    if (canFindTrail && rollChance(chance, random)) {
      grantTrail(context, encantadoId);
    }
  }
}

// Soma um Rastro de um encantado no estado e no resumo
export function grantTrail(context: RewardContext, encantadoId: string): void {
  const { draft, summary } = context;
  draft.trails[encantadoId] = (draft.trails[encantadoId] ?? 0) + 1;
  summary.trails[encantadoId] = (summary.trails[encantadoId] ?? 0) + 1;
  emit(context, { type: 'trail', encantadoId });
}

// Rastro só aparece para quem ainda não tem pacto e ainda não juntou o bastante
export function isTrailStillNeeded(state: GameState, encantadoId: string): boolean {
  const pact = getEncantado(encantadoId).pact;
  const isOwned = encantadoId in state.roster;

  if (isOwned || pact === null) {
    return false;
  }

  return (state.trails[encantadoId] ?? 0) < pact.trailsNeeded;
}

// Sorteia a queda de um amuleto e, se cair, guarda na mochila ou desmancha.
// As regras são de src/domain/amulets.ts. Aqui só se liga a derrota à queda.
export function rollAmulet(
  context: RewardContext,
  stage: number,
  isBoss: boolean,
  modifiers: Modifiers,
): void {
  const { draft, summary, random } = context;
  const dropInput = {
    stage,
    isBoss,
    dropChanceMultiplier: modifiers.amuletChance,
    amuletNumber: draft.nextAmuletNumber,
  };
  const amulet = rollAmuletDrop(dropInput, random);

  if (amulet === null) {
    return;
  }

  const received = receiveAmulet(draft, amulet);
  // receiveAmulet é pura e devolve um estado novo. Os campos dele são copiados para a
  // cópia de trabalho, que precisa continuar sendo o mesmo objeto até o fim.
  Object.assign(draft, received.state);

  summary.amuletsFound += 1;
  summary.amuletsSalvaged += received.wasSalvaged ? 1 : 0;
  summary.shavings += received.shavings;
  emit(context, {
    type: 'amulet',
    baseId: amulet.baseId,
    rarity: amulet.rarity,
    wasSalvaged: received.wasSalvaged,
    shavings: received.shavings,
  });
}

// Compra automática de melhorias ("Mão ligeira" do juazeiro), logo depois de cada
// recompensa. Se comprou algo, os multiplicadores são recalculados na hora.
export function runAutoBuy(context: RewardContext): void {
  const { draft } = context;
  const bought = autoBuyUpgrades(draft);

  if (bought === draft) {
    return;
  }

  // autoBuyUpgrades é pura e devolve um estado novo. Os campos são copiados para a
  // cópia de trabalho, que precisa continuar sendo o mesmo objeto até o fim.
  Object.assign(draft, bought);
  context.modifiersByPhase = getModifiersByPhase(draft);
}


// =============================================================================
// =============================================================================
// E N T R E G A   D A   B O L S A   D A   E X P E D I Ç Ã O

/**
 * Entrega as recompensas de visagens derrotadas fora do combate de estágios.
 *
 * É a ponte entre as expedições e as regras de recompensa: cada visagem da
 * bolsa rende Patacas, XP para a comitiva, Oferendas, Rastros da zona do mapa e,
 * com sorte, um amuleto, pelas mesmas regras do combate de estágios. A compra
 * automática de melhorias também roda depois de cada derrota.
 *
 * Função pura: não altera "state". Não mexe no combate de estágios, no estágio
 * atual nem na contagem até o chefe.
 *
 * @param state Estado de partida. Não é alterado.
 * @param kills Visagens derrotadas, na ordem em que caíram.
 * @param options Instante da entrega (decide dia, noite e lua dos Rastros) e sorteio.
 * @returns Estado novo, resumo do que rendeu e os eventos (se pedidos).
 *
 * Casos de borda: lista vazia devolve o mesmo "state" recebido, com o resumo
 * zerado. Todas as derrotas da lista usam o mesmo instante.
 */
export function rewardKills(
  state: GameState,
  kills: readonly MapKill[],
  options: SimulationOptions,
): SimulationResult {
  if (kills.length === 0) {
    return { state, summary: createEmptySummary(), events: [] };
  }

  const context = createRewardContext(state, options);

  for (const kill of kills) {
    const target = {
      enemy: getEnemy(kill.enemyId),
      stage: kill.stage,
      isBoss: false,
      zone: getZone(kill.zoneId),
    };
    grantKillRewards(context, target, getCurrentModifiers(context));
  }

  return toResult(context);
}
