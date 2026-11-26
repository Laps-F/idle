/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/expeditionSelectors.ts
 * O que faz: prepara os dados da expedição para a tela: a aba "Expedições" da
 * clareira, o painel ao lado do mapa, a janela da volta e a leitura de cada
 * quadro do canvas. Segue as mesmas regras de src/store/selectors.ts: os
 * componentes recebem tudo pronto e não fazem conta de jogo.
 *
 * Uso: const list = useGameStore(selectExpeditionList);
 *
 * O que muda a cada quadro (posição, vida, projéteis) não passa por seletor de
 * React. O canvas lê readSceneFrame com useGameStore.getState().
 *
 * Mapa:
 *   1. Tipos das visões
 *   2. Seletores e leitura de cada quadro
 *   3. Construção das visões
 */

import { BALANCE, EXPEDITION_MAPS } from '../data';
import {
  getEncantado,
  getEnemy,
  getExpeditionMap,
  getItem,
  getMapSize,
  getTileAt,
} from '../domain/catalog';
import {
  countLoot,
  countTrails,
  getExpeditionFighter,
  getTrailTargets,
} from '../domain/expedition';
import { getFighterBaseLevel, getMapStartLevel } from '../domain/expeditionScaling';
import type { ExpeditionOutcome, SceneEvent } from '../domain/types';
import { createStableSelector, toNamedAmounts } from './selectorTools';
import type { NamedAmount } from './selectorTools';
import type { GameSnapshot } from './types';

// =============================================================================
// =============================================================================
// T I P O S   D A S   V I S Õ E S

// O desenho de um mapa: um id de ladrilho por coluna, uma lista por linha
export interface MapView {
  id: string;
  name: string;
  width: number; // em ladrilhos
  height: number;
  tiles: string[][]; // tiles[linha][coluna] = id do ladrilho (src/data/world.ts)
  exit: { x: number; y: number }; // ladrilho da passagem de volta para a clareira
}

// Um mapa na aba "Expedições" da clareira
export interface ExpeditionOptionView {
  id: string;
  name: string;
  level: number; // nível das visagens no começo, pelo poder de quem sairia agora
  enemyNames: string[];
  footprints: NamedAmount[]; // de quem as pegadas podem ser agora, e quantas faltam
}

// Aba "Expedições": quem sairia, com quanta vida, e os mapas (com as pegadas que podem surgir)
export interface ExpeditionListView {
  leaderName: string | null; // null sem comitiva
  leaderMaxHp: number;
  durationSeconds: number;
  completionBonus: number; // de 0 a 1
  options: ExpeditionOptionView[];
}

// Painel ao lado do mapa durante a expedição
export interface ExpeditionHudView {
  mapName: string;
  leaderName: string;
  lootCount: number; // visagens na bolsa
  trailCount: number; // Rastros das pegadas na bolsa
}

// Uma visagem no quadro atual
export interface SceneEnemyFrame {
  uid: number;
  enemyId: string;
  name: string;
  level: number;
  x: number;
  y: number;
  hpFraction: number; // de 0 a 1
}

// Uma pegada de Rastro no quadro atual
export interface SceneFootprintFrame {
  uid: number;
  encantadoId: string;
  name: string; // nome do encantado que deixou a pegada
  x: number;
  y: number;
}

// Um projétil no quadro atual
export interface SceneProjectileFrame {
  uid: number;
  isSpecial: boolean;
  x: number;
  y: number;
}

// Tudo que o canvas desenha num quadro. Muda a cada tick, então não passa pelo React.
export interface SceneFrame {
  mapId: string;
  leaderId: string;
  playerX: number;
  playerY: number;
  hpFraction: number; // de 0 a 1
  hp: number;
  maxHp: number;
  isHurt: boolean; // levou golpe agora há pouco: a personagem pisca
  attackProgress: number; // de 0 a 1
  specialReadiness: number; // de 0 (acabou de usar) a 1 (pronto)
  secondsLeft: number; // até o fim do tempo da expedição
  lootCount: number;
  trailCount: number; // Rastros das pegadas pegas, na bolsa
  attackRange: number; // em ladrilhos
  projectileRadius: number; // em ladrilhos
  enemies: SceneEnemyFrame[];
  projectiles: SceneProjectileFrame[];
  footprints: SceneFootprintFrame[];
}

// Janela da volta: como terminou e o que a bolsa rendeu
export interface ExpeditionReportView {
  outcome: ExpeditionOutcome;
  mapName: string;
  seconds: number;
  kills: number;
  bonusKills: number;
  gold: number;
  xp: number;
  items: NamedAmount[];
  trails: NamedAmount[];
  levelUps: NamedAmount[];
  amuletsFound: number;
}

// Os eventos do mapa chegam à tela como o domínio manda (golpe, derrota e dano)
export type SceneEventView = SceneEvent;


// =============================================================================
// =============================================================================
// S E L E T O R E S   E   L E I T U R A   D E   C A D A   Q U A D R O

// O desenho de cada mapa é montado uma vez só: o mapa não muda durante o jogo
const mapViewCache = new Map<string, MapView>();

// Mapa da expedição em andamento, ou null na clareira
export function selectExpeditionMapView(snapshot: GameSnapshot): MapView | null {
  const mapId = snapshot.expeditionScene?.mapId ?? snapshot.expedition?.mapId;

  if (mapId === undefined) {
    return null;
  }

  const cached = mapViewCache.get(mapId);

  if (cached !== undefined) {
    return cached;
  }

  const view = buildMapView(mapId);
  mapViewCache.set(mapId, view);
  return view;
}

// Há expedição em andamento (a tela da expedição fica por cima da clareira)
export function selectIsOnExpedition(snapshot: GameSnapshot): boolean {
  return snapshot.expedition !== null;
}

// A cena do mapa está pausada (aba escondida, outra janela ou tecla P)
export function selectIsExpeditionPaused(snapshot: GameSnapshot): boolean {
  return snapshot.expedition !== null && snapshot.isExpeditionPaused;
}

export const selectExpeditionList = createStableSelector(buildExpeditionList);
export const selectExpeditionHud = createStableSelector(buildExpeditionHud);
export const selectExpeditionReport = createStableSelector(buildExpeditionReport);

/**
 * Leitura de cada quadro do canvas: personagem, visagens, projéteis, vida e tempo.
 *
 * Não use com useGameStore(...): muda a cada tick e redesenharia o React.
 * O canvas chama esta leitura com useGameStore.getState() a cada quadro.
 *
 * @param snapshot Retrato da store.
 * @returns O quadro, ou null sem expedição em andamento.
 */
export function readSceneFrame(snapshot: GameSnapshot): SceneFrame | null {
  const scene = snapshot.expeditionScene;
  const expedition = snapshot.expedition;

  if (scene === null || expedition === null) {
    return null;
  }

  return {
    mapId: scene.mapId,
    leaderId: expedition.encantadoId,
    playerX: scene.playerX,
    playerY: scene.playerY,
    hpFraction: scene.playerMaxHp > 0 ? scene.playerHp / scene.playerMaxHp : 0,
    hp: scene.playerHp,
    maxHp: scene.playerMaxHp,
    isHurt: scene.hurtSeconds > 0,
    attackProgress: scene.attackProgress,
    specialReadiness: 1 - scene.specialCooldown / BALANCE.specialCooldownSeconds,
    secondsLeft: Math.max(0, BALANCE.expeditionDurationSeconds - scene.elapsedSeconds),
    lootCount: countLoot(expedition.loot),
    trailCount: countTrails(expedition.trails),
    attackRange: BALANCE.attackRange,
    projectileRadius: BALANCE.projectileRadius,
    projectiles: scene.projectiles.map(({ uid, isSpecial, x, y }) => ({ uid, isSpecial, x, y })),
    footprints: scene.footprints.map(({ uid, encantadoId, x, y }) => ({
      uid,
      encantadoId,
      name: getEncantado(encantadoId).name,
      x,
      y,
    })),
    enemies: scene.enemies.map((enemy) => ({
      uid: enemy.uid,
      enemyId: enemy.enemyId,
      name: getEnemy(enemy.enemyId).name,
      level: enemy.level,
      x: enemy.x,
      y: enemy.y,
      hpFraction: enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0,
    })),
  };
}


// =============================================================================
// =============================================================================
// C O N S T R U Ç Ã O   D A S   V I S Õ E S

// Desenho de um mapa a partir de src/data/world.ts
function buildMapView(mapId: string): MapView {
  const map = getExpeditionMap(mapId);
  const { width, height } = getMapSize(map);
  const tiles = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, column) => getTileAt(map, column, row)?.id ?? 'desconhecido'),
  );

  return { id: map.id, name: map.name, width, height, tiles, exit: map.exit };
}

// Aba "Expedições": mapas e quem sairia agora
function buildExpeditionList(snapshot: GameSnapshot): ExpeditionListView {
  const fighter = getExpeditionFighter(snapshot, snapshot.lastSaveTimestamp);
  const baseLevel = getFighterBaseLevel(fighter?.damage ?? 0);

  return {
    leaderName: fighter === null ? null : getEncantado(fighter.encantadoId).name,
    leaderMaxHp: fighter?.maxHp ?? 0,
    durationSeconds: BALANCE.expeditionDurationSeconds,
    completionBonus: BALANCE.expeditionCompletionBonus,
    options: EXPEDITION_MAPS.map((map) => ({
      id: map.id,
      name: map.name,
      level: getMapStartLevel(baseLevel, map),
      enemyNames: map.enemyIds.map((enemyId) => getEnemy(enemyId).name),
      footprints: getTrailTargets(snapshot, map.id, snapshot.lastSaveTimestamp).map(
        ({ encantadoId, remaining }) => ({
          id: encantadoId,
          name: getEncantado(encantadoId).name,
          amount: remaining,
        }),
      ),
    })),
  };
}

// Painel ao lado do mapa: onde, quem e quanto já está na bolsa
function buildExpeditionHud(snapshot: GameSnapshot): ExpeditionHudView | null {
  const { expedition } = snapshot;

  if (expedition === null) {
    return null;
  }

  return {
    mapName: getExpeditionMap(expedition.mapId).name,
    leaderName: getEncantado(expedition.encantadoId).name,
    lootCount: countLoot(expedition.loot),
    trailCount: countTrails(expedition.trails),
  };
}

// Janela da volta, com nomes no lugar dos ids
function buildExpeditionReport(snapshot: GameSnapshot): ExpeditionReportView | null {
  const report = snapshot.expeditionReport;

  if (report === null) {
    return null;
  }

  const { summary } = report;
  const encantadoName = (id: string): string => getEncantado(id).name;

  return {
    outcome: report.outcome,
    mapName: getExpeditionMap(report.mapId).name,
    seconds: report.seconds,
    kills: report.kills,
    bonusKills: report.bonusKills,
    gold: summary.gold,
    xp: summary.xp,
    items: toNamedAmounts(summary.items, (id) => getItem(id).name),
    trails: toNamedAmounts(summary.trails, encantadoName),
    levelUps: toNamedAmounts(summary.levelUps, encantadoName),
    amuletsFound: summary.amuletsFound,
  };
}
