/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expedition.ts
 * O que faz: as regras da expedição que ficam salvas: quem sai, partir,
 * guardar as visagens derrotadas na bolsa e voltar para a clareira com o
 * saque. O que acontece no mapa em tempo real fica em expeditionScene.ts.
 *
 * Regras da volta:
 *   - A bolsa nunca se perde: voltar pela passagem, cair ou fechar o jogo
 *     entregam tudo o que foi juntado.
 *   - Quem aguenta até o fim do tempo ganha expeditionCompletionBonus de
 *     visagens extras na bolsa (hoje, o dobro de visagens).
 *   - A bolsa também guarda os Rastros das pegadas pegas no mapa (addTrailsToLoot).
 *   - A entrega usa o saque próprio do mapa (rewardExpeditionBag, em
 *     expeditionLoot.ts): Patacas, XP para a comitiva, Oferendas e amuletos pela
 *     tabela de src/data/expeditionLoot.ts, e os Rastros da bolsa.
 *   - getTrailTargets e getSceneSetup dizem de quem as pegadas podem ser e o que
 *     a cena recebe para começar.
 *
 * Funções puras: recebem o estado e devolvem um estado novo. Ação recusada
 * devolve null.
 *
 * Mapa:
 *   1. Quem sai em expedição
 *   2. Partir
 *   3. Bolsa
 *   4. Volta para a clareira
 */

import { BALANCE } from '../data/balance';
import { getEncantado, getExpeditionMap, getZone, hasExpeditionMap } from './catalog';
import { getDayPhase, matchesClock } from './clock';
import { getAttackDamage, getAttackInterval, getExpeditionMaxHp } from './formulas';
import { getModifiers } from './modifiers';
import { getClearingReference } from './expeditionGuarantee';
import { rewardExpeditionBag } from './expeditionLoot';
import { getRunModifiers, payPreparation } from './expeditionModifiers';
import { isTrailStillNeeded } from './rewards';
import type { SimulationOptions } from './rewards';
import type {
  ExpeditionFighter,
  ExpeditionLoot,
  ExpeditionOutcome,
  ExpeditionReport,
  GameState,
  MapKill,
  SceneSetup,
  TrailTarget,
} from './types';

// =============================================================================
// =============================================================================
// Q U E M   S A I   E M   E X P E D I Ç Ã O

/**
 * Os números de quem sai e reveza na expedição.
 *
 * Durante a expedição são os encantados que partiram (expedition.team). Fora
 * dela, é a comitiva (quem partiria agora), na ordem dela. Dano, velocidade e
 * crítico saem das mesmas fórmulas da clareira, com melhorias, sinergias,
 * amuletos e Raízes. A vida cresce com o nível do encantado (getExpeditionMaxHp).
 *
 * @param state Estado do jogo.
 * @param timestamp Instante atual em ms. Decide se valem as sinergias de dia ou de noite.
 * @returns Um por encantado, na ordem do revezamento. Vazio sem ninguém para sair.
 *
 * Caso de borda: quem não está mais no roster (salvamento estranho) fica de fora.
 */
export function getExpeditionFighters(state: GameState, timestamp: number): ExpeditionFighter[] {
  const ids = state.expedition?.team ?? state.party;
  const modifiers = getModifiers(state, getDayPhase(timestamp));

  return ids.flatMap((encantadoId) => {
    const owned = state.roster[encantadoId];

    if (owned === undefined) {
      return [];
    }

    const encantado = getEncantado(encantadoId);
    return [
      {
        encantadoId,
        damage: getAttackDamage(encantado, owned.level, modifiers, false),
        attackInterval: getAttackInterval(encantado, modifiers),
        critChance: modifiers.critChance,
        maxHp: getExpeditionMaxHp(owned.level),
      },
    ];
  });
}

/**
 * Os números de quem entra em campo primeiro (o primeiro de getExpeditionFighters).
 *
 * @param state Estado do jogo.
 * @param timestamp Instante atual em ms.
 * @returns Os números, ou null sem ninguém para sair.
 */
export function getExpeditionFighter(
  state: GameState,
  timestamp: number,
): ExpeditionFighter | null {
  return getExpeditionFighters(state, timestamp)[0] ?? null;
}


// =============================================================================
// =============================================================================
// P A R T I R

// Dá para partir: tem comitiva, não há expedição em andamento e o mapa existe
export function canStartExpedition(state: GameState, mapId: string): boolean {
  return state.party.length > 0 && state.expedition === null && hasExpeditionMap(mapId);
}

/**
 * Parte em expedição com a comitiva inteira (revezamento) e, se pedido, um preparo.
 *
 * O primeiro da comitiva entra em campo; os outros esperam a vez. A clareira para
 * enquanto isso. O preparo é pago na hora, com Oferendas (src/domain/expeditionModifiers.ts).
 *
 * @param state Estado do jogo. Não é alterado.
 * @param mapId Mapa da expedição.
 * @param preparationId Preparo de src/data/expeditionPreparations.ts, ou null para nenhum.
 * @returns Estado com a expedição em andamento, a bolsa vazia e as Oferendas do preparo
 *          descontadas, ou null se não der para partir (sem comitiva, já em expedição, mapa
 *          que não existe, preparo que não existe ou Oferendas de menos).
 */
export function startExpedition(
  state: GameState,
  mapId: string,
  preparationId: string | null = null,
): GameState | null {
  const encantadoId = state.party[0];

  if (!canStartExpedition(state, mapId) || encantadoId === undefined) {
    return null;
  }

  const paid = preparationId === null ? state : payPreparation(state, preparationId);

  if (paid === null) {
    return null;
  }

  const expedition = {
    mapId,
    encantadoId,
    team: [...state.party],
    loot: [],
    trails: {},
    preparationId,
    activeSeconds: 0,
  };
  return { ...paid, expedition };
}


/**
 * O que a cena precisa para começar a expedição em andamento.
 *
 * @param state Estado com a expedição já em andamento (depois de startExpedition).
 * @param timestamp Instante da partida em ms. Decide sinergias de dia ou de noite e de
 *                  quem as pegadas podem ser (o Boitatá só à noite).
 * @returns Mapa, quem sai, de quem são as pegadas, a chance de Rastro de quem sai e o que
 *          o preparo muda na partida. Null sem expedição em andamento.
 */
export function getSceneSetup(state: GameState, timestamp: number): SceneSetup | null {
  const { expedition } = state;

  if (expedition === null) {
    return null;
  }

  return {
    mapId: expedition.mapId,
    fighters: getExpeditionFighters(state, timestamp),
    trailTargets: getTrailTargets(state, expedition.mapId, timestamp),
    trailChance: getModifiers(state, getDayPhase(timestamp)).trailChance,
    modifiers: getRunModifiers(expedition.preparationId),
  };
}


// =============================================================================
// =============================================================================
// B O L S A

/**
 * Guarda na bolsa as visagens derrotadas no mapa.
 *
 * Visagens do mesmo tipo e do mesmo nível ficam numa linha só, com a contagem.
 *
 * @param state Estado do jogo. Não é alterado.
 * @param kills Visagens derrotadas no passo.
 * @returns Estado com a bolsa nova. Sem expedição ou sem derrotas, devolve o mesmo "state".
 */
export function addKillsToLoot(state: GameState, kills: readonly MapKill[]): GameState {
  const { expedition } = state;

  if (expedition === null || kills.length === 0) {
    return state;
  }

  const loot = kills.reduce<ExpeditionLoot[]>(addKill, expedition.loot);
  return { ...state, expedition: { ...expedition, loot } };
}

/**
 * Guarda na bolsa os Rastros das pegadas pegas no mapa.
 *
 * @param state Estado do jogo. Não é alterado.
 * @param encantadoIds Encantado de cada pegada pega no passo (um Rastro cada).
 * @returns Estado com a bolsa nova. Sem expedição ou sem pegadas, devolve o mesmo "state".
 */
export function addTrailsToLoot(state: GameState, encantadoIds: readonly string[]): GameState {
  const { expedition } = state;

  if (expedition === null || encantadoIds.length === 0) {
    return state;
  }

  const trails = { ...expedition.trails };

  for (const encantadoId of encantadoIds) {
    trails[encantadoId] = (trails[encantadoId] ?? 0) + 1;
  }

  return { ...state, expedition: { ...expedition, trails } };
}

// Quantos Rastros há na bolsa
export function countTrails(trails: Readonly<Record<string, number>>): number {
  return Object.values(trails).reduce((sum, amount) => sum + amount, 0);
}

/**
 * De quem as pegadas podem ser num mapa, e quantas ainda valem a pena.
 *
 * Entram os encantados da zona do mapa (encounters de src/data/zones.ts) que
 * ainda precisam de Rastro para o pacto e cuja hora (dia, noite, lua) bate com
 * "timestamp". Para cada um, o que falta para o pacto menos o que já está na
 * bolsa da expedição em andamento.
 *
 * @param state Estado do jogo.
 * @param mapId Mapa da expedição.
 * @param timestamp Instante em ms. Decide dia, noite e lua.
 * @returns Lista na ordem da zona. Vazia se ninguém precisa de Rastro agora.
 */
export function getTrailTargets(
  state: GameState,
  mapId: string,
  timestamp: number,
): TrailTarget[] {
  const zone = getZone(getExpeditionMap(mapId).zoneId);
  const inBag = state.expedition?.trails ?? {};

  return zone.encounters
    .filter((encounter) => matchesClock(encounter, timestamp))
    .filter((encounter) => isTrailStillNeeded(state, encounter.encantadoId))
    .map(({ encantadoId }) => ({
      encantadoId,
      remaining: getTrailsMissing(state, encantadoId) - (inBag[encantadoId] ?? 0),
    }))
    .filter((target) => target.remaining > 0);
}

// Rastros que ainda faltam para o pacto de um encantado (zero se já tem ou não precisa)
function getTrailsMissing(state: GameState, encantadoId: string): number {
  const pact = getEncantado(encantadoId).pact;
  return pact === null ? 0 : Math.max(0, pact.trailsNeeded - (state.trails[encantadoId] ?? 0));
}

// Quantas visagens há na bolsa
export function countLoot(loot: readonly ExpeditionLoot[]): number {
  return loot.reduce((sum, entry) => sum + entry.count, 0);
}

// Soma uma derrota na linha do mesmo tipo e nível, ou abre uma linha nova
function addKill(loot: ExpeditionLoot[], kill: MapKill): ExpeditionLoot[] {
  const index = loot.findIndex(
    (entry) => entry.enemyId === kill.enemyId && entry.level === kill.stage,
  );

  if (index === -1) {
    return [...loot, { enemyId: kill.enemyId, level: kill.stage, count: 1 }];
  }

  return loot.map((entry, position) =>
    position === index ? { ...entry, count: entry.count + 1 } : entry,
  );
}


// =============================================================================
// =============================================================================
// V O L T A   P A R A   A   C L A R E I R A

/**
 * Termina a expedição e entrega a bolsa na clareira.
 *
 * Fórmula do bônus: com "concluida", entram piso(visagens × expeditionCompletionBonus)
 * visagens extras, repetindo a bolsa na ordem em que foi juntada.
 *
 * Garantia da clareira: a bolsa rende pelo menos as Patacas e o XP que a clareira
 * teria rendido em "seconds" (src/domain/expeditionGuarantee.ts), em qualquer
 * desfecho.
 *
 * Função pura: não altera "state".
 *
 * @param state Estado com a expedição em andamento. Não é alterado.
 * @param outcome Como a expedição terminou. Só "concluida" dá bônus.
 * @param seconds Quanto tempo a expedição andou, sem as pausas (relatório e garantia).
 * @param options Instante da entrega e sorteio das quedas (Oferendas, Rastros, amuletos).
 * @param fallen Quem caiu no caminho (para o relatório). Padrão: ninguém.
 * @returns Estado sem expedição, com o saque entregue, e o relatório da volta.
 *
 * Casos de borda: sem expedição em andamento, devolve o mesmo estado e relatório null.
 * Bolsa vazia termina a expedição com relatório zerado.
 */
export function finishExpedition(
  state: GameState,
  outcome: ExpeditionOutcome,
  seconds: number,
  options: SimulationOptions,
  fallen: readonly string[] = [],
): { state: GameState; report: ExpeditionReport | null } {
  const { expedition } = state;

  if (expedition === null) {
    return { state, report: null };
  }

  const zoneId = getExpeditionMap(expedition.mapId).zoneId;
  const kills = expandLoot(expedition.loot, zoneId);
  const bonusCount =
    outcome === 'concluida' ? Math.floor(kills.length * BALANCE.expeditionCompletionBonus) : 0;
  const bonusKills = Array.from({ length: bonusCount }, (_, index) => kills[index % kills.length])
    .filter((kill): kill is MapKill => kill !== undefined);
  const allKills = [...kills, ...bonusKills];
  const reference = getClearingReference(state, seconds, options.startTimestamp);
  const bag = {
    mapId: expedition.mapId,
    kills: allKills,
    trails: expedition.trails,
    floor: reference,
    teamSize: expedition.team.length,
  };
  const result = rewardExpeditionBag(state, bag, options);

  return {
    state: { ...result.state, expedition: null },
    report: {
      outcome,
      mapId: expedition.mapId,
      seconds,
      kills: kills.length,
      bonusKills: bonusKills.length,
      preparationId: expedition.preparationId,
      team: [...expedition.team],
      fallen: [...fallen],
      summary: result.summary,
      clearingGold: reference.gold,
      clearingXp: reference.xp,
      guaranteeGold: result.guarantee.gold,
      guaranteeXp: result.guarantee.xp,
    },
  };
}

// Transforma as linhas da bolsa numa lista de derrotas, uma por visagem
function expandLoot(loot: readonly ExpeditionLoot[], zoneId: string): MapKill[] {
  return loot.flatMap((entry) =>
    Array.from({ length: entry.count }, () => ({
      enemyId: entry.enemyId,
      stage: entry.level,
      zoneId,
    })),
  );
}
