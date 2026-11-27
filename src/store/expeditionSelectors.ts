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

import { BALANCE, EXPEDITION_MAPS, EXPEDITION_PREPARATIONS } from '../data';
import {
  getEncantado,
  getEnemy,
  getExpeditionMap,
  getExpeditionPreparation,
  getItem,
  getMapSize,
  getSpecial,
  getTileAt,
  hasSpecial,
} from '../domain/catalog';
import {
  countLoot,
  countTrails,
  getExpeditionFighters,
  getTrailTargets,
} from '../domain/expedition';
import { canAffordPreparation } from '../domain/expeditionModifiers';
import { getSpecialCooldown } from '../domain/expeditionSpecials';
import { getMapStartLevel, getTeamBaseLevel } from '../domain/expeditionScaling';
import type { ExpeditionOutcome, ExpeditionScene, SceneEvent } from '../domain/types';
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
// Um preparo que dá para escolher antes de partir
export interface ExpeditionPreparationView {
  id: string;
  name: string;
  description: string;
  cost: NamedAmount[]; // Oferendas que o preparo gasta
  have: NamedAmount[]; // quanto de cada uma está guardado, na mesma ordem
  canAfford: boolean;
}

// Um encantado da comitiva, para escolher quem sai primeiro
export interface PartyLeaderOptionView {
  id: string;
  name: string;
  isLeader: boolean;
  specialName: string; // golpe especial dele na expedição
}

// O golpe especial de quem sai (src/data/specials.ts)
export interface SpecialView {
  name: string;
  description: string;
  cooldownSeconds: number; // sem preparo
}

export interface ExpeditionListView {
  leaderName: string | null; // quem entra em campo primeiro; null sem comitiva
  partyMembers: PartyLeaderOptionView[]; // na ordem da comitiva; o primeiro entra em campo
  relayMembers: TeamKeyView[]; // quem sai junto e espera a vez (tecla 2 e 3)
  leaderMaxHp: number;
  leaderSpecial: SpecialView | null; // null sem comitiva
  durationSeconds: number;
  completionBonus: number; // de 0 a 1
  options: ExpeditionOptionView[];
  preparations: ExpeditionPreparationView[];
}

// Um encantado de quem saiu, com a tecla que põe ele em campo
export interface TeamKeyView {
  key: string; // '1', '2' ou '3'
  name: string;
  specialName: string;
}

// Painel ao lado do mapa durante a expedição
export interface ExpeditionHudView {
  mapName: string;
  activeName: string; // quem está em campo agora
  special: SpecialView; // golpe de quem está em campo
  team: TeamKeyView[]; // quem saiu, na ordem das teclas
  lootCount: number; // visagens na bolsa
  trailCount: number; // Rastros das pegadas na bolsa
  preparationName: string | null; // preparo desta expedição, ou null
}

// Um de quem saiu, no quadro atual (faixa de baixo do mapa)
export interface SceneTeamFrame {
  encantadoId: string;
  key: string; // tecla que põe em campo
  name: string;
  hpFraction: number; // de 0 a 1
  specialReadiness: number; // de 0 a 1; a recarga anda também fora de campo
  isActive: boolean;
  isDown: boolean;
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
  isSlowed: boolean; // Assobio da Caipora
  isConfused: boolean; // Pés virados do Curupira
  isBurning: boolean; // Rastro de fogo do Boitatá
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
  activeId: string; // quem está em campo (a figura da personagem)
  playerX: number;
  playerY: number;
  hpFraction: number; // de 0 a 1
  hp: number;
  maxHp: number;
  isHurt: boolean; // levou golpe agora há pouco: a personagem pisca
  isInvulnerable: boolean; // no Redemoinho do Saci: nenhuma encostada tira vida
  attackProgress: number; // de 0 a 1
  specialReadiness: number; // de 0 (acabou de usar) a 1 (pronto)
  team: SceneTeamFrame[]; // quem saiu. Vazio na cena sem time.
  swapReadiness: number; // de 0 (acabou de trocar) a 1 (dá para trocar)
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
  preparationName: string | null; // preparo usado, ou null
  clearingGold: number; // o que a clareira teria rendido no mesmo tempo
  clearingXp: number;
  guaranteeGold: number; // o que a garantia pagou (zero se a bolsa já passou)
  guaranteeXp: number;
  teamNames: string[]; // quem saiu
  fallenNames: string[]; // quem caiu no caminho
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
    activeId: scene.team[scene.activeIndex]?.encantadoId ?? expedition.encantadoId,
    playerX: scene.playerX,
    playerY: scene.playerY,
    hpFraction: scene.playerMaxHp > 0 ? scene.playerHp / scene.playerMaxHp : 0,
    hp: scene.playerHp,
    maxHp: scene.playerMaxHp,
    isHurt: scene.hurtSeconds > 0,
    isInvulnerable: scene.invulnerableSeconds > 0,
    attackProgress: scene.attackProgress,
    specialReadiness: getSpecialReadiness(scene),
    team: scene.team.map((member, index) => ({
      encantadoId: member.encantadoId,
      key: String(index + 1),
      name: getEncantado(member.encantadoId).name,
      hpFraction: member.maxHp > 0 ? Math.max(0, member.hp) / member.maxHp : 0,
      specialReadiness: getReadiness(member.specialCooldown, member.specialCooldownTotal),
      isActive: index === scene.activeIndex,
      isDown: member.isDown,
    })),
    swapReadiness: getReadiness(scene.swapCooldown, BALANCE.swapCooldownSeconds),
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
      isSlowed: enemy.slowSeconds > 0,
      isConfused: enemy.confusedSeconds > 0,
      isBurning: enemy.burnSeconds > 0,
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
  const fighters = getExpeditionFighters(snapshot, snapshot.lastSaveTimestamp);
  const fighter = fighters[0] ?? null;
  const baseLevel = getTeamBaseLevel(fighters);

  return {
    leaderName: fighter === null ? null : getEncantado(fighter.encantadoId).name,
    leaderMaxHp: fighter?.maxHp ?? 0,
    leaderSpecial: fighter === null ? null : buildSpecialView(fighter.encantadoId),
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
    preparations: buildPreparations(snapshot),
    partyMembers: snapshot.party.map((id, index) => ({
      id,
      name: getEncantado(id).name,
      isLeader: index === 0,
      specialName: buildSpecialView(id).name,
    })),
    relayMembers: buildTeamKeys(snapshot.party).slice(1),
  };
}

// Painel ao lado do mapa: onde, quem e quanto já está na bolsa
function buildExpeditionHud(snapshot: GameSnapshot): ExpeditionHudView | null {
  const { expedition } = snapshot;

  if (expedition === null) {
    return null;
  }

  const scene = snapshot.expeditionScene;
  const activeId = scene?.team[scene.activeIndex]?.encantadoId ?? expedition.encantadoId;

  return {
    mapName: getExpeditionMap(expedition.mapId).name,
    activeName: getEncantado(activeId).name,
    special: buildSpecialView(activeId),
    team: buildTeamKeys(expedition.team),
    lootCount: countLoot(expedition.loot),
    trailCount: countTrails(expedition.trails),
    preparationName: getPreparationName(expedition.preparationId),
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
    preparationName: getPreparationName(report.preparationId),
    clearingGold: report.clearingGold,
    clearingXp: report.clearingXp,
    guaranteeGold: report.guaranteeGold,
    guaranteeXp: report.guaranteeXp,
    teamNames: report.team.map(encantadoName),
    fallenNames: report.fallen.map(encantadoName),
  };
}

// Quem saiu (ou sairia), com a tecla e o golpe de cada um
function buildTeamKeys(ids: readonly string[]): TeamKeyView[] {
  return ids.map((id, index) => ({
    key: String(index + 1),
    name: getEncantado(id).name,
    specialName: buildSpecialView(id).name,
  }));
}

// Quanto o golpe especial de quem está em campo já recarregou: 0 (acabou de sair) a 1 (pronto)
function getSpecialReadiness(scene: ExpeditionScene): number {
  return getReadiness(scene.specialCooldown, scene.specialCooldownTotal);
}

// Quanto uma recarga já andou: 0 (acabou de começar) a 1 (pronta). Recarga sem tamanho: pronta.
function getReadiness(remaining: number, total: number): number {
  if (total <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, 1 - remaining / total));
}

// Golpe especial de um encantado, com a recarga sem preparo
function buildSpecialView(encantadoId: string): SpecialView {
  if (!hasSpecial(encantadoId)) {
    return {
      name: 'Golpe especial',
      description: 'Um projétil que atravessa as visagens no caminho.',
      cooldownSeconds: getSpecialCooldown(encantadoId, 1),
    };
  }

  const special = getSpecial(encantadoId);
  return {
    name: special.name,
    description: special.description,
    cooldownSeconds: special.cooldownSeconds,
  };
}

// Nome do preparo, ou null sem preparo
function getPreparationName(preparationId: string | null): string | null {
  return preparationId === null ? null : getExpeditionPreparation(preparationId).name;
}

// Cada preparo com o custo, o que está guardado e se dá para pagar
function buildPreparations(snapshot: GameSnapshot): ExpeditionPreparationView[] {
  return EXPEDITION_PREPARATIONS.map((preparation) => {
    const itemIds = Object.keys(preparation.cost);
    const toAmounts = (counters: Record<string, number>): NamedAmount[] =>
      itemIds.map((id) => ({ id, name: getItem(id).name, amount: counters[id] ?? 0 }));
    return {
      id: preparation.id,
      name: preparation.name,
      description: preparation.description,
      cost: toAmounts(preparation.cost),
      have: toAmounts(snapshot.inventory),
      canAfford: canAffordPreparation(snapshot, preparation.id),
    };
  });
}
