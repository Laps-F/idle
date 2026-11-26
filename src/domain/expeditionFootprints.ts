/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionFootprints.ts
 * O que faz: as pegadas de Rastro no mapa da expedição. Elas surgem de tempos
 * em tempos num ladrilho livre longe da personagem, às vezes onde uma visagem
 * caiu, e viram um Rastro na bolsa quando a personagem passa por cima.
 *
 * Regras (decididas em 26/11/2026, Caminho 1):
 *   - A expedição é a fonte principal de Rastros. A clareira continua dando
 *     poucos (clearingTrailMultiplier), para quem só joga idle não travar.
 *   - Só aparecem pegadas de encantados que ainda precisam de Rastro para o
 *     pacto, da zona do mapa e na hora certa (o Boitatá só à noite). Quem são e
 *     quantas faltam vem pronto na montagem da cena (TrailTarget), calculado
 *     por getTrailTargets, em src/domain/expedition.ts.
 *   - Nunca surge mais pegada do que falta: "remaining" desce a cada pegada que
 *     surge. Pegada que fica no chão quando a expedição acaba se perde.
 *   - A chance de Rastro de quem sai (Olho de mateiro, sinergia da mata, Faro
 *     de mateiro do juazeiro) encurta o intervalo entre pegadas.
 *
 * Pureza: as funções alteram só a cena de trabalho (o "draft" de advanceScene)
 * e as listas do contexto do passo, como o resto do passo da cena.
 *
 * Mapa:
 *   1. Tipos
 *   2. Montagem
 *   3. Passo: surgir e pegar
 *   4. Pegada onde a visagem caiu
 */

import { BALANCE } from '../data/balance';
import { pickRandom, rollChance } from '../utils/random';
import type { RandomSource } from '../utils/random';
import {
  getDistance,
  getPlayerPoint,
  listFreeTileCenters,
  SCENE_EPSILON,
} from './sceneGeometry';
import type { Point } from './sceneGeometry';
import type {
  ExpeditionMapDef,
  ExpeditionScene,
  SceneEvent,
  SceneFootprint,
  TrailTarget,
} from './types';

// =============================================================================
// =============================================================================
// T I P O S

// O que as pegadas precisam do passo da cena. O StepContext de expeditionScene.ts serve.
export interface FootprintContext {
  draft: ExpeditionScene;
  map: ExpeditionMapDef;
  random: RandomSource;
  events: SceneEvent[];
  trails: string[]; // encantado de cada pegada pega no passo
}


// =============================================================================
// =============================================================================
// M O N T A G E M

/**
 * Intervalo entre duas pegadas, pela chance de Rastro de quem sai.
 *
 * Fórmula: footprintSpawnSeconds ÷ trailChance. Com chance dobrada, as pegadas
 * surgem duas vezes mais rápido.
 *
 * @param trailChance Multiplicador de chance de Rastro (Modifiers.trailChance).
 * @returns Segundos entre pegadas. Multiplicador zero, negativo ou que não é
 *          número vale 1 (o intervalo normal).
 */
export function getFootprintInterval(trailChance: number): number {
  const multiplier = trailChance > 0 && Number.isFinite(trailChance) ? trailChance : 1;
  return BALANCE.footprintSpawnSeconds / multiplier;
}

// Só os alvos que ainda valem alguma pegada, em cópias (a cena altera "remaining")
export function copyTrailTargets(targets: readonly TrailTarget[]): TrailTarget[] {
  return targets
    .filter((target) => target.remaining > 0)
    .map((target) => ({ encantadoId: target.encantadoId, remaining: target.remaining }));
}


// =============================================================================
// =============================================================================
// P A S S O :   S U R G I R   E   P E G A R

// Um passo das pegadas: a personagem pega as que estão perto e, na hora, surge uma nova
export function updateFootprints(context: FootprintContext, seconds: number): void {
  const { draft } = context;
  collectNearbyFootprints(context);

  draft.footprintTimer = Math.max(0, draft.footprintTimer - seconds);

  if (draft.footprintTimer > SCENE_EPSILON) {
    return;
  }

  draft.footprintTimer = draft.footprintIntervalSeconds;
  const spot = pickFootprintSpot(context);

  if (spot !== null) {
    placeFootprint(context, spot);
  }
}

// Passou por cima: a pegada some e vira um Rastro na bolsa
function collectNearbyFootprints(context: FootprintContext): void {
  const { draft } = context;
  const player = getPlayerPoint(draft);
  const remaining: SceneFootprint[] = [];

  for (const footprint of draft.footprints) {
    if (getDistance(footprint, player) <= BALANCE.footprintPickupRange) {
      context.trails.push(footprint.encantadoId);
      context.events.push({
        type: 'trail',
        x: footprint.x,
        y: footprint.y,
        encantadoId: footprint.encantadoId,
      });
    } else {
      remaining.push(footprint);
    }
  }

  draft.footprints = remaining;
}

// Ladrilho livre longe da personagem, sorteado. Sem nenhum longe, qualquer livre.
function pickFootprintSpot(context: FootprintContext): Point | null {
  const { draft, map, random } = context;
  const player = getPlayerPoint(draft);
  const freeSpots = listFreeTileCenters(map);
  const farSpots = freeSpots.filter(
    (spot) => getDistance(spot, player) >= BALANCE.footprintMinSpawnDistance,
  );
  const options = farSpots.length > 0 ? farSpots : freeSpots;
  return options.length > 0 ? pickRandom(options, random) : null;
}

/**
 * Põe uma pegada no ponto pedido, se houver encantado que ainda precise e se o
 * chão ainda não estiver cheio (footprintMaxOnMap).
 *
 * O encantado é sorteado entre os que ainda têm pegada a surgir. O "remaining"
 * dele desce um.
 *
 * @param context Contexto do passo. Altera draft.footprints e draft.trailTargets.
 * @param spot Centro da pegada, em ladrilhos.
 * @returns true se a pegada surgiu.
 */
function placeFootprint(context: FootprintContext, spot: Point): boolean {
  const { draft, random } = context;
  const candidates = draft.trailTargets.filter((target) => target.remaining > 0);

  if (candidates.length === 0 || draft.footprints.length >= BALANCE.footprintMaxOnMap) {
    return false;
  }

  const target = pickRandom(candidates, random);
  target.remaining -= 1;
  draft.footprints.push({
    uid: draft.nextFootprintUid,
    encantadoId: target.encantadoId,
    x: spot.x,
    y: spot.y,
  });
  draft.nextFootprintUid += 1;
  return true;
}


// =============================================================================
// =============================================================================
// P E G A D A   O N D E   A   V I S A G E M   C A I U

// Com sorte (footprintDropChance), a visagem derrotada deixa uma pegada onde caiu
export function maybeDropFootprint(context: FootprintContext, spot: Point): void {
  const { draft } = context;
  const hasTarget = draft.trailTargets.some((target) => target.remaining > 0);
  const hasRoom = draft.footprints.length < BALANCE.footprintMaxOnMap;

  // Sem quem precise ou sem lugar, nem sorteia (o sorteio das outras coisas não muda)
  if (hasTarget && hasRoom && rollChance(BALANCE.footprintDropChance, context.random)) {
    placeFootprint(context, spot);
  }
}
