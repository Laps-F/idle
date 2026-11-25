/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/world.ts
 * O que faz: as regras do mundo aberto em tempo real. Monta a cena de um mapa,
 * anda com a personagem respeitando árvores e água, troca de mapa pelas
 * passagens, faz as visagens passearem e voltarem depois de derrotadas, e
 * cuida do ataque automático da personagem.
 *
 * Como funciona: a cena (WorldScene) é tudo que está no mapa agora. Ela só
 * existe com o jogo aberto e não é salva. advanceWorld recebe a cena, a
 * direção que a pessoa aperta e o tempo que passou, e devolve a cena nova, as
 * visagens derrotadas e os eventos para a tela desenhar. As recompensas não
 * são daqui: quem chama entrega as derrotas para rewardKills
 * (src/domain/simulation.ts), que usa as mesmas regras do combate de estágios.
 *
 * Pureza: as funções públicas são puras. Não alteram o que recebem, não leem
 * o relógio e o sorteio entra por parâmetro. Por dentro, advanceWorld
 * trabalha numa cópia privada da cena (o "draft"), como simulation.ts.
 *
 * Coordenadas em ladrilhos (ver o bloco "Mundo aberto" de src/domain/types.ts).
 *
 * Mapa:
 *   1. Constantes e tipos
 *   2. Funções públicas
 *   3. Passo da cena
 *   4. Personagem: movimento e passagens
 *   5. Visagens: nascimento, passeio e volta
 *   6. Ataque automático
 *   7. Geometria
 */

import { BALANCE } from '../data/balance';
import { pickRandom, rollChance } from '../utils/random';
import type { RandomSource } from '../utils/random';
import { getEncantado, getEnemy, getMapSize, getTileAt, getWorldMap } from './catalog';
import { getDayPhase } from './clock';
import { getAttackDamage, getAttackInterval, getEnemyMaxHp } from './formulas';
import { getModifiers } from './modifiers';
import type {
  GameState,
  WorldEnemy,
  WorldEvent,
  WorldFighter,
  WorldInput,
  WorldKill,
  WorldMapDef,
  WorldPortalDef,
  WorldScene,
  WorldStepResult,
} from './types';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

// Folga para erro de arredondamento ao comparar tempos, distâncias e progressos
const EPSILON = 1e-9;

// Quantas vezes a visagem tenta achar um ponto livre para passear antes de ficar parada
const WANDER_ATTEMPTS = 6;

// Tudo que um passo precisa. O draft é a cópia de trabalho da cena.
interface StepContext {
  draft: WorldScene;
  map: WorldMapDef;
  fighter: WorldFighter | null;
  random: RandomSource;
  kills: WorldKill[];
  events: WorldEvent[];
}

// Um ponto do mapa, em ladrilhos
interface Point {
  x: number;
  y: number;
}


// =============================================================================
// =============================================================================
// F U N Ç Õ E S   P Ú B L I C A S

/**
 * Monta a cena de um mapa, já com as visagens em campo.
 *
 * @param mapId Mapa da cena. Precisa existir em src/data/world.ts.
 * @param position Onde a personagem aparece, em ladrilhos. Null usa o início do mapa.
 * @param random Fonte de sorteio para o lugar e o tipo de cada visagem.
 * @returns Cena nova, com a barra de ataque vazia e maxEnemies visagens no mapa.
 * @throws Error se o mapa não existir.
 *
 * Casos de borda: posição dentro de árvore, água ou fora do mapa é trocada pelo
 * início do mapa. Mapa sem lugar livre longe da personagem põe as visagens em
 * qualquer lugar livre.
 */
export function createWorldScene(
  mapId: string,
  position: Point | null,
  random: RandomSource,
): WorldScene {
  const map = getWorldMap(mapId);
  const start = getMapStart(map);
  const player =
    position !== null && isWalkablePosition(map, position.x, position.y) ? position : start;
  const context: StepContext = {
    draft: {
      mapId,
      playerX: player.x,
      playerY: player.y,
      attackProgress: 0,
      enemies: [],
      respawnTimers: [],
      nextEnemyUid: 1,
    },
    map,
    fighter: null,
    random,
    kills: [],
    events: [],
  };

  for (let count = 0; count < map.maxEnemies; count += 1) {
    spawnEnemy(context);
  }

  return context.draft;
}

/**
 * Avança a cena do mapa por um intervalo de tempo.
 *
 * Algoritmo: o intervalo é dividido em passos de no máximo worldMaxStepSeconds.
 * Em cada passo, na ordem: a personagem anda (com colisão), a passagem é
 * conferida, as visagens passeiam, as derrotadas voltam quando dá o tempo e a
 * personagem bate na visagem mais perto, se a barra de ataque estiver cheia.
 *
 * Função pura: não altera "scene" nem "input".
 *
 * @param scene Cena de partida. Não é alterada.
 * @param fighter Quem anda e bate (getWorldFighter). Null: a personagem anda, mas não bate.
 * @param input Direção apertada. Cada eixo de -1 a 1. Na diagonal a velocidade é a mesma.
 * @param seconds Quantos segundos de jogo simular.
 * @param random Fonte de sorteio (crítico, passeio e nascimento das visagens).
 * @returns Cena nova, visagens derrotadas (para as recompensas) e eventos para a tela.
 *
 * Casos de borda:
 * - "seconds" zero, negativo ou NaN: devolve a mesma cena, sem derrotas nem eventos.
 * - Ao pisar numa passagem, a cena vira a do outro mapa, com visagens novas, e o
 *   resto do intervalo continua lá. A barra de ataque começa vazia no mapa novo.
 * - No máximo um golpe por passo. Com ataque mais rápido que um passo (0,05 s),
 *   os golpes ficam limitados a 20 por segundo.
 * - A barra de ataque enche mesmo sem visagem por perto e fica cheia esperando:
 *   o golpe sai assim que uma visagem entra no alcance.
 */
export function advanceWorld(
  scene: WorldScene,
  fighter: WorldFighter | null,
  input: WorldInput,
  seconds: number,
  random: RandomSource,
): WorldStepResult {
  if (!(seconds > 0)) {
    return { scene, kills: [], events: [] };
  }

  const context: StepContext = {
    draft: structuredClone(scene),
    map: getWorldMap(scene.mapId),
    fighter,
    random,
    kills: [],
    events: [],
  };
  let remainingSeconds = seconds;

  while (remainingSeconds > EPSILON) {
    const stepSeconds = Math.min(remainingSeconds, BALANCE.worldMaxStepSeconds);
    runStep(context, input, stepSeconds);
    remainingSeconds -= stepSeconds;
  }

  return { scene: context.draft, kills: context.kills, events: context.events };
}

/**
 * Quem anda e bate no mapa: o primeiro encantado da comitiva.
 *
 * Os números saem das mesmas fórmulas do combate de estágios, com melhorias,
 * sinergias, amuletos e Raízes. Os outros membros da comitiva não batem no
 * mapa neste protótipo, mas recebem o XP das derrotas.
 *
 * @param state Estado do jogo.
 * @param timestamp Instante atual em ms. Decide se valem as sinergias de dia ou de noite.
 * @returns Dano, intervalo e chance de crítico, ou null sem comitiva.
 */
export function getWorldFighter(state: GameState, timestamp: number): WorldFighter | null {
  const leadId = state.party[0];
  const owned = leadId === undefined ? undefined : state.roster[leadId];

  if (leadId === undefined || owned === undefined) {
    return null;
  }

  const encantado = getEncantado(leadId);
  const modifiers = getModifiers(state, getDayPhase(timestamp));

  return {
    encantadoId: leadId,
    damage: getAttackDamage(encantado, owned.level, modifiers, false),
    attackInterval: getAttackInterval(encantado, modifiers),
    critChance: modifiers.critChance,
  };
}

/**
 * Leva para o estado salvo o que precisa ficar de um passo do mapa.
 *
 * Função pura: devolve um estado novo.
 *
 * @param state Estado do jogo. Não é alterado.
 * @param scene Cena depois do passo.
 * @param seconds Tempo do passo, somado ao tempo de jogo e ao tempo da edição.
 * @returns Estado com a posição da personagem (mapa, x e y) e os tempos atualizados.
 *
 * Caso de borda: "seconds" zero, negativo ou NaN não soma tempo, só grava a posição.
 */
export function recordWorldStep(state: GameState, scene: WorldScene, seconds: number): GameState {
  const playedSeconds = seconds > 0 ? seconds : 0;

  return {
    ...state,
    world: { mapId: scene.mapId, x: scene.playerX, y: scene.playerY },
    editionSeconds: state.editionSeconds + playedSeconds,
    stats: { ...state.stats, playTimeSeconds: state.stats.playTimeSeconds + playedSeconds },
  };
}

/**
 * Diz se um corpo redondo cabe num ponto do mapa sem encostar em árvore ou água.
 *
 * A conta é feita pelo quadrado em volta do corpo: os quatro cantos precisam
 * cair em ladrilhos que dá para pisar.
 *
 * @param map Mapa consultado.
 * @param x Centro do corpo, em ladrilhos.
 * @param y Centro do corpo, em ladrilhos.
 * @param radius Metade da largura do corpo. Padrão: bodyRadius de src/data/balance.ts.
 * @returns true se o ponto está livre. False fora do mapa ou com valor que não é número.
 */
export function isWalkablePosition(
  map: WorldMapDef,
  x: number,
  y: number,
  radius: number = BALANCE.bodyRadius,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  const corners: Point[] = [
    { x: x - radius, y: y - radius },
    { x: x + radius, y: y - radius },
    { x: x - radius, y: y + radius },
    { x: x + radius, y: y + radius },
  ];

  return corners.every((corner) => {
    const tile = getTileAt(map, Math.floor(corner.x), Math.floor(corner.y));
    return tile !== null && !tile.isSolid;
  });
}

// Centro do ladrilho onde a personagem começa no mapa
export function getMapStart(map: WorldMapDef): Point {
  return toTileCenter(map.start.x, map.start.y);
}


// =============================================================================
// =============================================================================
// P A S S O   D A   C E N A

// Um passo curto, na ordem: andar, passagem, visagens, volta das derrotadas, golpe
function runStep(context: StepContext, input: WorldInput, seconds: number): void {
  movePlayer(context, input, seconds);

  if (enterPortalIfStanding(context)) {
    return;
  }

  for (const enemy of context.draft.enemies) {
    updateEnemy(context, enemy, seconds);
  }

  updateRespawns(context, seconds);
  updateAttack(context, seconds);
}


// =============================================================================
// =============================================================================
// P E R S O N A G E M :   M O V I M E N T O   E   P A S S A G E N S

// Anda na direção apertada. Cada eixo é conferido sozinho, para deslizar ao encostar.
function movePlayer(context: StepContext, input: WorldInput, seconds: number): void {
  const { draft, map } = context;
  const direction = normalizeInput(input);
  const distance = BALANCE.playerSpeed * seconds;
  const nextX = draft.playerX + direction.x * distance;
  const nextY = draft.playerY + direction.y * distance;

  if (direction.x !== 0 && isWalkablePosition(map, nextX, draft.playerY)) {
    draft.playerX = nextX;
  }
  if (direction.y !== 0 && isWalkablePosition(map, draft.playerX, nextY)) {
    draft.playerY = nextY;
  }
}

// Entrada limitada ao círculo de raio 1: na diagonal não se anda mais rápido
function normalizeInput(input: WorldInput): Point {
  const x = clampAxis(input.moveX);
  const y = clampAxis(input.moveY);
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

// Um eixo da entrada entre -1 e 1. Valor que não é número vira 0.
function clampAxis(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

// Se a personagem está sobre uma passagem, troca a cena pela do outro mapa
function enterPortalIfStanding(context: StepContext): boolean {
  const portal = findPortalAt(context.map, context.draft.playerX, context.draft.playerY);

  if (portal === null) {
    return false;
  }

  const arrival = toTileCenter(portal.toX, portal.toY);
  context.draft = createWorldScene(portal.toMapId, arrival, context.random);
  context.map = getWorldMap(portal.toMapId);
  context.events.push({ type: 'mapChanged', mapId: portal.toMapId });
  return true;
}

// Passagem do ladrilho onde o ponto está, ou null
function findPortalAt(map: WorldMapDef, x: number, y: number): WorldPortalDef | null {
  const column = Math.floor(x);
  const row = Math.floor(y);
  return map.portals.find((portal) => portal.x === column && portal.y === row) ?? null;
}


// =============================================================================
// =============================================================================
// V I S A G E N S :   N A S C I M E N T O ,   P A S S E I O   E   V O L T A

// Põe uma visagem sorteada num lugar livre, longe da personagem. Sem lugar livre, não põe.
function spawnEnemy(context: StepContext): void {
  const { draft, map, random } = context;
  const spot = pickSpawnSpot(context);

  if (spot === null) {
    return;
  }

  const enemyId = pickRandom(map.enemyIds, random);
  const maxHp = getEnemyMaxHp(map.level, getEnemy(enemyId), false);
  const enemy: WorldEnemy = {
    uid: draft.nextEnemyUid,
    enemyId,
    x: spot.x,
    y: spot.y,
    hp: maxHp,
    maxHp,
    targetX: spot.x,
    targetY: spot.y,
    waitSeconds: rollWaitSeconds(random),
  };

  draft.nextEnemyUid += 1;
  draft.enemies.push(enemy);
}

// Centro de um ladrilho livre, de preferência a enemyMinSpawnDistance da personagem
function pickSpawnSpot(context: StepContext): Point | null {
  const { draft, map, random } = context;
  const player = { x: draft.playerX, y: draft.playerY };
  const freeSpots = listFreeTileCenters(map);
  const farSpots = freeSpots.filter(
    (spot) => getDistance(spot, player) >= BALANCE.enemyMinSpawnDistance,
  );
  const options = farSpots.length > 0 ? farSpots : freeSpots;
  return options.length > 0 ? pickRandom(options, random) : null;
}

// Centro de todo ladrilho onde uma visagem pode nascer: livre e fora das passagens
function listFreeTileCenters(map: WorldMapDef): Point[] {
  const { width, height } = getMapSize(map);
  const spots: Point[] = [];

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const center = toTileCenter(column, row);
      const isPortal = findPortalAt(map, center.x, center.y) !== null;

      if (!isPortal && isWalkablePosition(map, center.x, center.y)) {
        spots.push(center);
      }
    }
  }

  return spots;
}

// A visagem espera parada ou anda até o ponto escolhido. Ao chegar, escolhe outro.
function updateEnemy(context: StepContext, enemy: WorldEnemy, seconds: number): void {
  if (enemy.waitSeconds > 0) {
    enemy.waitSeconds = Math.max(0, enemy.waitSeconds - seconds);
    return;
  }

  const target = { x: enemy.targetX, y: enemy.targetY };
  const distanceLeft = getDistance(enemy, target);
  const stepLength = BALANCE.enemySpeed * seconds;

  if (distanceLeft <= stepLength) {
    enemy.x = target.x;
    enemy.y = target.y;
    chooseNextWander(context, enemy);
    return;
  }

  const nextX = enemy.x + ((target.x - enemy.x) / distanceLeft) * stepLength;
  const nextY = enemy.y + ((target.y - enemy.y) / distanceLeft) * stepLength;

  if (isWalkablePosition(context.map, nextX, nextY)) {
    enemy.x = nextX;
    enemy.y = nextY;
  } else {
    chooseNextWander(context, enemy);
  }
}

// Sorteia o tempo parada e o próximo ponto do passeio. Sem ponto livre, fica onde está.
function chooseNextWander(context: StepContext, enemy: WorldEnemy): void {
  const { map, random } = context;
  enemy.waitSeconds = rollWaitSeconds(random);
  enemy.targetX = enemy.x;
  enemy.targetY = enemy.y;

  for (let attempt = 0; attempt < WANDER_ATTEMPTS; attempt += 1) {
    const angle = random() * 2 * Math.PI;
    const distance = random() * BALANCE.enemyWanderRadius;
    const x = enemy.x + Math.cos(angle) * distance;
    const y = enemy.y + Math.sin(angle) * distance;

    if (isWalkablePosition(map, x, y)) {
      enemy.targetX = x;
      enemy.targetY = y;
      return;
    }
  }
}

// Tempo parada entre dois passeios, entre enemyWaitSecondsMin e enemyWaitSecondsMax
function rollWaitSeconds(random: RandomSource): number {
  const range = BALANCE.enemyWaitSecondsMax - BALANCE.enemyWaitSecondsMin;
  return BALANCE.enemyWaitSecondsMin + random() * range;
}

// Desconta o tempo de cada visagem derrotada e põe de volta as que já podem voltar
function updateRespawns(context: StepContext, seconds: number): void {
  const { draft } = context;
  const timers = draft.respawnTimers.map((timer) => timer - seconds);
  const readyCount = timers.filter((timer) => timer <= EPSILON).length;

  draft.respawnTimers = timers.filter((timer) => timer > EPSILON);

  for (let count = 0; count < readyCount; count += 1) {
    spawnEnemy(context);
  }
}


// =============================================================================
// =============================================================================
// A T A Q U E   A U T O M Á T I C O

// Enche a barra de ataque e, cheia, bate na visagem mais perto dentro do alcance
function updateAttack(context: StepContext, seconds: number): void {
  const { draft, fighter } = context;

  if (fighter === null) {
    return;
  }

  draft.attackProgress = Math.min(1, draft.attackProgress + seconds / fighter.attackInterval);

  if (draft.attackProgress < 1 - EPSILON) {
    return;
  }

  const target = findNearestEnemy(draft, BALANCE.attackRange);

  if (target !== null) {
    draft.attackProgress = 0;
    strike(context, fighter, target);
  }
}

// Visagem mais perto da personagem dentro da distância pedida, ou null
function findNearestEnemy(draft: WorldScene, range: number): WorldEnemy | null {
  const player = { x: draft.playerX, y: draft.playerY };
  let nearest: WorldEnemy | null = null;
  let nearestDistance = range;

  for (const enemy of draft.enemies) {
    const distance = getDistance(enemy, player);

    if (distance <= nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }
  }

  return nearest;
}

// Um golpe, com chance de crítico. Se a vida zerar, a visagem sai do mapa e entra na contagem.
function strike(context: StepContext, fighter: WorldFighter, enemy: WorldEnemy): void {
  const { draft, map, random } = context;
  const isCrit = rollChance(fighter.critChance, random);
  const damage = isCrit ? fighter.damage * BALANCE.critMultiplier : fighter.damage;

  enemy.hp = Math.max(0, enemy.hp - damage);
  context.events.push({ type: 'hit', x: enemy.x, y: enemy.y, damage, isCrit });

  if (enemy.hp > 0) {
    return;
  }

  draft.enemies = draft.enemies.filter((candidate) => candidate.uid !== enemy.uid);
  draft.respawnTimers.push(BALANCE.enemyRespawnSeconds);
  context.kills.push({ enemyId: enemy.enemyId, stage: map.level, zoneId: map.zoneId });
  context.events.push({ type: 'defeat', x: enemy.x, y: enemy.y, enemyId: enemy.enemyId });
}


// =============================================================================
// =============================================================================
// G E O M E T R I A

// Centro de um ladrilho
function toTileCenter(column: number, row: number): Point {
  return { x: column + 0.5, y: row + 0.5 };
}

// Distância em linha reta entre dois pontos
function getDistance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
