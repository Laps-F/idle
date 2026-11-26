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
 *     visagens extras na bolsa (50% a mais).
 *   - A entrega usa rewardKills (simulation.ts): Patacas, XP para a comitiva,
 *     Oferendas, Rastros e amuletos pelas mesmas regras da clareira.
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
import { getEncantado, getExpeditionMap, hasExpeditionMap } from './catalog';
import { getDayPhase } from './clock';
import { getAttackDamage, getAttackInterval, getExpeditionMaxHp } from './formulas';
import { getModifiers } from './modifiers';
import { rewardKills } from './simulation';
import type { SimulationOptions } from './simulation';
import type {
  ExpeditionFighter,
  ExpeditionLoot,
  ExpeditionOutcome,
  ExpeditionReport,
  GameState,
  MapKill,
} from './types';

// =============================================================================
// =============================================================================
// Q U E M   S A I   E M   E X P E D I Ç Ã O

/**
 * Os números de quem anda e bate na expedição.
 *
 * Durante a expedição é o encantado que partiu. Fora dela, é o primeiro da
 * comitiva (quem partiria agora). Dano, velocidade e crítico saem das mesmas
 * fórmulas da clareira, com melhorias, sinergias, amuletos e Raízes. A vida
 * cresce com o nível do encantado (getExpeditionMaxHp).
 *
 * @param state Estado do jogo.
 * @param timestamp Instante atual em ms. Decide se valem as sinergias de dia ou de noite.
 * @returns Os números, ou null sem ninguém para sair.
 */
export function getExpeditionFighter(
  state: GameState,
  timestamp: number,
): ExpeditionFighter | null {
  const encantadoId = state.expedition?.encantadoId ?? state.party[0];
  const owned = encantadoId === undefined ? undefined : state.roster[encantadoId];

  if (encantadoId === undefined || owned === undefined) {
    return null;
  }

  const encantado = getEncantado(encantadoId);
  const modifiers = getModifiers(state, getDayPhase(timestamp));

  return {
    encantadoId,
    damage: getAttackDamage(encantado, owned.level, modifiers, false),
    attackInterval: getAttackInterval(encantado, modifiers),
    critChance: modifiers.critChance,
    maxHp: getExpeditionMaxHp(owned.level),
  };
}


// =============================================================================
// =============================================================================
// P A R T I R

// Dá para partir: tem comitiva, não há expedição em andamento e o mapa existe
export function canStartExpedition(state: GameState, mapId: string): boolean {
  return state.party.length > 0 && state.expedition === null && hasExpeditionMap(mapId);
}

/**
 * Parte em expedição com o primeiro encantado da comitiva.
 *
 * A clareira continua rendendo enquanto isso: nada do combate por estágios muda.
 *
 * @param state Estado do jogo. Não é alterado.
 * @param mapId Mapa da expedição.
 * @returns Estado com a expedição em andamento e a bolsa vazia, ou null se não der para
 *          partir (sem comitiva, já em expedição ou mapa que não existe).
 */
export function startExpedition(state: GameState, mapId: string): GameState | null {
  const encantadoId = state.party[0];

  if (!canStartExpedition(state, mapId) || encantadoId === undefined) {
    return null;
  }

  return { ...state, expedition: { mapId, encantadoId, loot: [] } };
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
 * Função pura: não altera "state".
 *
 * @param state Estado com a expedição em andamento. Não é alterado.
 * @param outcome Como a expedição terminou. Só "concluida" dá bônus.
 * @param seconds Quanto tempo a expedição durou (vai para o relatório).
 * @param options Instante da entrega e sorteio das quedas (Oferendas, Rastros, amuletos).
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
  const result = rewardKills(state, [...kills, ...bonusKills], options);

  return {
    state: { ...result.state, expedition: null },
    report: {
      outcome,
      mapId: expedition.mapId,
      seconds,
      kills: kills.length,
      bonusKills: bonusKills.length,
      summary: result.summary,
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
