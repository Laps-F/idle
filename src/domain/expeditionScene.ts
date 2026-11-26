/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionScene.ts
 * O que faz: as regras da expedição em tempo real. Monta a cena de um mapa,
 * anda com a personagem respeitando árvores e água, faz as visagens
 * passearem, perseguirem e baterem, solta as ondas cada vez mais fortes,
 * cuida do golpe automático e do golpe especial, e diz quando a expedição
 * acaba (fim do tempo, vida zerada ou passagem de volta).
 *
 * Os golpes são projéteis: o comum voa na visagem mais perto e para na
 * primeira que acerta; o especial voa para o lado em que a personagem anda e
 * atravessa todas no caminho. Projétil some ao bater em árvore ou água, ou
 * depois de andar a distância máxima.
 *
 * Como funciona: a cena (ExpeditionScene) é tudo que está no mapa agora. Ela
 * só existe com o jogo aberto e não é salva. advanceScene recebe a cena, o
 * que a pessoa está fazendo e o tempo que passou, e devolve a cena nova, as
 * visagens derrotadas, os eventos para a tela e, se for o caso, como a
 * expedição terminou. A bolsa e as recompensas não são daqui: ficam em
 * src/domain/expedition.ts.
 *
 * Pureza: as funções públicas são puras. Não alteram o que recebem, não leem
 * o relógio e o sorteio entra por parâmetro. Por dentro, advanceScene
 * trabalha numa cópia privada da cena (o "draft"), como simulation.ts.
 *
 * Coordenadas em ladrilhos (ver o bloco "Expedições" de src/domain/types.ts).
 *
 * Mapa:
 *   1. Constantes e tipos
 *   2. Funções públicas
 *   3. Passo da cena
 *   4. Personagem: movimento e passagem de volta
 *   5. Visagens: ondas, passeio, perseguição e encostada (bloco "Visagens")
 *   6. Golpes: automático e especial (os disparos)
 *   7. Projéteis: voo, acerto e fim
 *   8. Geometria
 */

import { BALANCE } from '../data/balance';
import { pickRandom, rollChance } from '../utils/random';
import type { RandomSource } from '../utils/random';
import { getEnemy, getExpeditionMap, getMapSize, getTileAt } from './catalog';
import { getEnemyContactDamage, getEnemyMaxHp } from './formulas';
import type {
  ExpeditionFighter,
  ExpeditionInput,
  ExpeditionMapDef,
  ExpeditionOutcome,
  ExpeditionScene,
  MapKill,
  SceneEnemy,
  SceneEvent,
  SceneProjectile,
  SceneStepResult,
} from './types';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

// Folga para erro de arredondamento ao comparar tempos, distâncias e progressos
const EPSILON = 1e-9;

// Quantas vezes a visagem tenta achar um ponto livre para passear antes de ficar parada
const WANDER_ATTEMPTS = 6;

const SECONDS_PER_MINUTE = 60;

// Tudo que um passo precisa. O draft é a cópia de trabalho da cena.
interface StepContext {
  draft: ExpeditionScene;
  map: ExpeditionMapDef;
  fighter: ExpeditionFighter | null;
  random: RandomSource;
  kills: MapKill[];
  events: SceneEvent[];
  outcome: ExpeditionOutcome | null;
  isSpecialPending: boolean; // o pedido de golpe especial vale uma vez por chamada
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
 * Monta a cena do começo de uma expedição.
 *
 * @param mapId Mapa da expedição. Precisa existir em src/data/world.ts.
 * @param maxHp Vida cheia da personagem (ExpeditionFighter.maxHp).
 * @param random Fonte de sorteio para o lugar e o tipo das primeiras visagens.
 * @returns Cena no tempo zero: personagem no início do mapa, olhando para a direita, com a vida
 *          cheia, golpe especial pronto e waveStartEnemies visagens longe dela.
 * @throws Error se o mapa não existir.
 */
export function createExpeditionScene(
  mapId: string,
  maxHp: number,
  random: RandomSource,
): ExpeditionScene {
  const map = getExpeditionMap(mapId);
  const start = toTileCenter(map.start.x, map.start.y);
  const context = createContext(
    {
      mapId,
      elapsedSeconds: 0,
      playerX: start.x,
      playerY: start.y,
      playerHp: maxHp,
      playerMaxHp: maxHp,
      hurtSeconds: 0,
      attackProgress: 0,
      specialCooldown: 0,
      facingX: 1,
      facingY: 0,
      enemies: [],
      projectiles: [],
      spawnTimer: BALANCE.waveSpawnSecondsStart,
      nextEnemyUid: 1,
      nextProjectileUid: 1,
    },
    null,
    random,
  );

  for (let count = 0; count < BALANCE.waveStartEnemies; count += 1) {
    spawnEnemy(context);
  }

  return context.draft;
}

/**
 * Avança a cena da expedição por um intervalo de tempo.
 *
 * Algoritmo: o intervalo é dividido em passos de no máximo sceneMaxStepSeconds.
 * Em cada passo, na ordem: o tempo corre, a personagem anda (com colisão), a
 * passagem de volta é conferida, as visagens passeiam ou perseguem e batem ao
 * encostar, o projétil especial sai (se pedido e pronto), o projétil comum
 * sai (se a barra encheu e há visagem no alcance), os projéteis voam e
 * acertam, as ondas trazem visagens novas e o fim do tempo é conferido.
 * Quando a expedição acaba, o resto do intervalo é ignorado.
 *
 * Função pura: não altera "scene" nem "input".
 *
 * @param scene Cena de partida. Não é alterada.
 * @param fighter Quem anda e bate. Null: a personagem anda, mas não bate.
 * @param input Direção (cada eixo de -1 a 1) e pedido de golpe especial.
 * @param seconds Quantos segundos de jogo simular.
 * @param random Fonte de sorteio (crítico, passeio e nascimento das visagens).
 * @returns Cena nova, visagens derrotadas, eventos para a tela e como a expedição
 *          terminou (null se ela continua).
 *
 * Casos de borda:
 * - "seconds" zero, negativo ou NaN: devolve a mesma cena, sem nada acontecer.
 * - O pedido de golpe especial vale uma vez por chamada. Com o golpe em recarga,
 *   o pedido é ignorado (não fica guardado).
 * - Na diagonal a velocidade é a mesma das quatro direções.
 * - No máximo um disparo automático por passo (até 20 por segundo).
 * - O projétil comum mira onde a visagem estava no disparo. Se ela sair do
 *   caminho, ele segue reto e pode acertar outra ou sumir.
 * - Se a vida zera e o tempo acaba no mesmo passo, vale "caiu".
 */
export function advanceScene(
  scene: ExpeditionScene,
  fighter: ExpeditionFighter | null,
  input: ExpeditionInput,
  seconds: number,
  random: RandomSource,
): SceneStepResult {
  if (!(seconds > 0)) {
    return { scene, kills: [], events: [], outcome: null };
  }

  const context = createContext(structuredClone(scene), fighter, random);
  context.isSpecialPending = input.useSpecial;
  let remainingSeconds = seconds;

  while (remainingSeconds > EPSILON && context.outcome === null) {
    const stepSeconds = Math.min(remainingSeconds, BALANCE.sceneMaxStepSeconds);
    runStep(context, input, stepSeconds);
    remainingSeconds -= stepSeconds;
  }

  return {
    scene: context.draft,
    kills: context.kills,
    events: context.events,
    outcome: context.outcome,
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
  map: ExpeditionMapDef,
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

// Nível das visagens que nascem em certo momento: sobe um a cada waveLevelUpSeconds
export function getWaveLevel(map: ExpeditionMapDef, elapsedSeconds: number): number {
  return map.level + Math.floor(elapsedSeconds / BALANCE.waveLevelUpSeconds);
}


// =============================================================================
// =============================================================================
// P A S S O   D A   C E N A

// Contexto de trabalho de um passo, a partir de uma cena que já é cópia
function createContext(
  draft: ExpeditionScene,
  fighter: ExpeditionFighter | null,
  random: RandomSource,
): StepContext {
  return {
    draft,
    map: getExpeditionMap(draft.mapId),
    fighter,
    random,
    kills: [],
    events: [],
    outcome: null,
    isSpecialPending: false,
  };
}

// Um passo curto, na ordem descrita em advanceScene
function runStep(context: StepContext, input: ExpeditionInput, seconds: number): void {
  const { draft } = context;
  draft.elapsedSeconds += seconds;
  draft.hurtSeconds = Math.max(0, draft.hurtSeconds - seconds);
  draft.specialCooldown = Math.max(0, draft.specialCooldown - seconds);

  movePlayer(context, input, seconds);
  if (isOnExit(context)) {
    context.outcome = 'voltou';
    return;
  }

  for (const enemy of draft.enemies) {
    updateEnemy(context, enemy, seconds);
  }
  if (draft.playerHp <= 0) {
    context.outcome = 'caiu';
    return;
  }

  fireSpecialIfPending(context);
  updateAttack(context, seconds);
  updateProjectiles(context, seconds);
  updateWaves(context, seconds);

  if (draft.elapsedSeconds >= BALANCE.expeditionDurationSeconds - EPSILON) {
    context.outcome = 'concluida';
  }
}


// =============================================================================
// =============================================================================
// P E R S O N A G E M :   M O V I M E N T O   E   P A S S A G E M   D E   V O L T A

// Anda na direção apertada. Cada eixo é conferido sozinho, para deslizar ao encostar.
function movePlayer(context: StepContext, input: ExpeditionInput, seconds: number): void {
  const { draft, map } = context;
  const direction = normalizeInput(input);
  const distance = BALANCE.playerSpeed * seconds;
  const nextX = draft.playerX + direction.x * distance;
  const nextY = draft.playerY + direction.y * distance;

  if (direction.x !== 0 || direction.y !== 0) {
    const length = Math.hypot(direction.x, direction.y);
    draft.facingX = direction.x / length;
    draft.facingY = direction.y / length;
  }
  if (direction.x !== 0 && isWalkablePosition(map, nextX, draft.playerY)) {
    draft.playerX = nextX;
  }
  if (direction.y !== 0 && isWalkablePosition(map, draft.playerX, nextY)) {
    draft.playerY = nextY;
  }
}

// Entrada limitada ao círculo de raio 1: na diagonal não se anda mais rápido
function normalizeInput(input: ExpeditionInput): Point {
  const x = clampAxis(input.moveX);
  const y = clampAxis(input.moveY);
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

// Um eixo da entrada entre -1 e 1. Valor que não é número vira 0.
function clampAxis(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

// A personagem está sobre o ladrilho da passagem de volta para a clareira
function isOnExit(context: StepContext): boolean {
  const { draft, map } = context;
  return Math.floor(draft.playerX) === map.exit.x && Math.floor(draft.playerY) === map.exit.y;
}


// =============================================================================
// =============================================================================
// V I S A G E N S :   O N D A S ,   P A S S E I O ,   P E R S E G U I Ç Ã O

// Conta o tempo até a próxima visagem. Ela só entra se o mapa ainda não estiver cheio.
function updateWaves(context: StepContext, seconds: number): void {
  const { draft } = context;
  const minutes = draft.elapsedSeconds / SECONDS_PER_MINUTE;
  const extraEnemies = Math.floor(minutes * BALANCE.waveMaxEnemiesPerMinute);
  const maxEnemies = BALANCE.waveMaxEnemiesStart + extraEnemies;

  draft.spawnTimer = Math.max(0, draft.spawnTimer - seconds);

  if (draft.spawnTimer > 0 || draft.enemies.length >= maxEnemies) {
    return;
  }

  spawnEnemy(context);
  draft.spawnTimer = Math.max(
    BALANCE.waveSpawnSecondsMin,
    BALANCE.waveSpawnSecondsStart - minutes * BALANCE.waveSpawnSpeedupPerMinute,
  );
}

// Põe uma visagem sorteada num lugar livre, longe da personagem. Sem lugar livre, não põe.
function spawnEnemy(context: StepContext): void {
  const { draft, map, random } = context;
  const spot = pickSpawnSpot(context);

  if (spot === null) {
    return;
  }

  const enemyId = pickRandom(map.enemyIds, random);
  const enemyDef = getEnemy(enemyId);
  const level = getWaveLevel(map, draft.elapsedSeconds);
  const maxHp = getEnemyMaxHp(level, enemyDef, false);
  const enemy: SceneEnemy = {
    uid: draft.nextEnemyUid,
    enemyId,
    level,
    x: spot.x,
    y: spot.y,
    hp: maxHp,
    maxHp,
    damage: getEnemyContactDamage(level, enemyDef),
    hitCooldown: 0,
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
  const player = getPlayer(draft);
  const freeSpots = listFreeTileCenters(map);
  const farSpots = freeSpots.filter(
    (spot) => getDistance(spot, player) >= BALANCE.enemyMinSpawnDistance,
  );
  const options = farSpots.length > 0 ? farSpots : freeSpots;
  return options.length > 0 ? pickRandom(options, random) : null;
}

// Centro de todo ladrilho onde uma visagem pode nascer: livre e fora da passagem de volta
function listFreeTileCenters(map: ExpeditionMapDef): Point[] {
  const { width, height } = getMapSize(map);
  const spots: Point[] = [];

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const center = toTileCenter(column, row);
      const isExit = column === map.exit.x && row === map.exit.y;

      if (!isExit && isWalkablePosition(map, center.x, center.y)) {
        spots.push(center);
      }
    }
  }

  return spots;
}

// Perto da personagem, a visagem persegue e bate. Longe, passeia.
function updateEnemy(context: StepContext, enemy: SceneEnemy, seconds: number): void {
  const player = getPlayer(context.draft);
  const distance = getDistance(enemy, player);
  enemy.hitCooldown = Math.max(0, enemy.hitCooldown - seconds);

  if (distance <= BALANCE.enemyAggroRange) {
    chasePlayer(context, enemy, distance, seconds);
    touchPlayer(context, enemy);
  } else {
    wander(context, enemy, seconds);
  }
}

// Anda em direção à personagem, até encostar. Encostada em árvore, desliza pelo eixo livre.
function chasePlayer(
  context: StepContext,
  enemy: SceneEnemy,
  distance: number,
  seconds: number,
): void {
  const player = getPlayer(context.draft);
  const stepLength = Math.min(
    BALANCE.enemyChaseSpeed * seconds,
    Math.max(0, distance - BALANCE.enemyContactRange * 0.8),
  );

  if (stepLength <= 0 || distance <= EPSILON) {
    return;
  }

  const nextX = enemy.x + ((player.x - enemy.x) / distance) * stepLength;
  const nextY = enemy.y + ((player.y - enemy.y) / distance) * stepLength;

  if (isWalkablePosition(context.map, nextX, enemy.y)) {
    enemy.x = nextX;
  }
  if (isWalkablePosition(context.map, enemy.x, nextY)) {
    enemy.y = nextY;
  }
}

// Encostada na personagem e fora da recarga, a visagem bate
function touchPlayer(context: StepContext, enemy: SceneEnemy): void {
  const { draft } = context;
  const distance = getDistance(enemy, getPlayer(draft));

  if (distance > BALANCE.enemyContactRange || enemy.hitCooldown > 0) {
    return;
  }

  draft.playerHp = Math.max(0, draft.playerHp - enemy.damage);
  draft.hurtSeconds = BALANCE.hurtFlashSeconds;
  enemy.hitCooldown = BALANCE.enemyHitCooldownSeconds;
  context.events.push({
    type: 'hurt',
    x: draft.playerX,
    y: draft.playerY,
    damage: enemy.damage,
  });
}

// A visagem espera parada ou anda até o ponto escolhido. Ao chegar, escolhe outro.
function wander(context: StepContext, enemy: SceneEnemy, seconds: number): void {
  if (enemy.waitSeconds > 0) {
    enemy.waitSeconds = Math.max(0, enemy.waitSeconds - seconds);
    return;
  }

  const target = { x: enemy.targetX, y: enemy.targetY };
  const distanceLeft = getDistance(enemy, target);
  const stepLength = BALANCE.enemyWanderSpeed * seconds;

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
function chooseNextWander(context: StepContext, enemy: SceneEnemy): void {
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


// =============================================================================
// =============================================================================
// G O L P E S :   A U T O M Á T I C O   E   E S P E C I A L

// Enche a barra de ataque e, cheia, atira na visagem mais perto dentro do alcance
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

  if (target === null) {
    return;
  }

  const player = getPlayer(draft);
  const isCrit = rollChance(fighter.critChance, context.random);
  draft.attackProgress = 0;
  launchProjectile(context, {
    isSpecial: false,
    direction: { x: target.x - player.x, y: target.y - player.y },
    speed: BALANCE.projectileSpeed,
    maxDistance: BALANCE.projectileMaxDistance,
    damage: isCrit ? fighter.damage * BALANCE.critMultiplier : fighter.damage,
    isCrit,
  });
}

// Projétil especial: sai para o lado em que a personagem olha. Só se pedido e pronto.
function fireSpecialIfPending(context: StepContext): void {
  const { draft, fighter } = context;
  const isRequested = context.isSpecialPending;
  context.isSpecialPending = false;

  if (!isRequested || draft.specialCooldown > 0 || fighter === null) {
    return;
  }

  draft.specialCooldown = BALANCE.specialCooldownSeconds;
  launchProjectile(context, {
    isSpecial: true,
    direction: { x: draft.facingX, y: draft.facingY },
    speed: BALANCE.specialProjectileSpeed,
    maxDistance: BALANCE.specialProjectileMaxDistance,
    damage: fighter.damage * BALANCE.specialDamageMultiplier,
    isCrit: false,
  });
}

// Visagem mais perto da personagem dentro da distância pedida, ou null
function findNearestEnemy(draft: ExpeditionScene, range: number): SceneEnemy | null {
  const player = getPlayer(draft);
  let nearest: SceneEnemy | null = null;
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

// Tira vida da visagem. Se zerar, ela sai do mapa e vai para a lista de derrotas.
function damageEnemy(
  context: StepContext,
  enemy: SceneEnemy,
  damage: number,
  isCrit: boolean,
): void {
  const { draft, map } = context;
  enemy.hp = Math.max(0, enemy.hp - damage);
  context.events.push({ type: 'hit', x: enemy.x, y: enemy.y, damage, isCrit });

  if (enemy.hp > 0) {
    return;
  }

  draft.enemies = draft.enemies.filter((candidate) => candidate.uid !== enemy.uid);
  context.kills.push({ enemyId: enemy.enemyId, stage: enemy.level, zoneId: map.zoneId });
  context.events.push({ type: 'defeat', x: enemy.x, y: enemy.y, enemyId: enemy.enemyId });
}


// =============================================================================
// =============================================================================
// P R O J É T E I S :   V O O ,   A C E R T O   E   F I M

// O que um disparo precisa dizer
interface LaunchOptions {
  isSpecial: boolean;
  direction: Point; // qualquer tamanho. Direção zero vira "para a direita".
  speed: number;
  maxDistance: number;
  damage: number;
  isCrit: boolean;
}

// Põe um projétil no mapa, saindo do centro da personagem
function launchProjectile(context: StepContext, options: LaunchOptions): void {
  const { draft } = context;
  const length = Math.hypot(options.direction.x, options.direction.y);
  const projectile: SceneProjectile = {
    uid: draft.nextProjectileUid,
    isSpecial: options.isSpecial,
    x: draft.playerX,
    y: draft.playerY,
    directionX: length > EPSILON ? options.direction.x / length : 1,
    directionY: length > EPSILON ? options.direction.y / length : 0,
    speed: options.speed,
    remainingDistance: options.maxDistance,
    damage: options.damage,
    isCrit: options.isCrit,
    hitEnemyUids: [],
  };

  draft.nextProjectileUid += 1;
  draft.projectiles.push(projectile);
}

// Cada projétil voa um trecho. Os que acabaram (acerto, parede ou distância) saem do mapa.
function updateProjectiles(context: StepContext, seconds: number): void {
  const { draft } = context;
  draft.projectiles = draft.projectiles.filter((projectile) =>
    flyProjectile(context, projectile, seconds),
  );
}

/**
 * Faz um projétil voar um trecho e acertar as visagens no caminho.
 *
 * O acerto é conferido no segmento inteiro que o projétil percorreu no passo,
 * e não só no ponto final, para um projétil rápido não atravessar uma visagem
 * sem tocar nela.
 *
 * @param context Contexto do passo. A visagem acertada perde vida aqui.
 * @param projectile Projétil, alterado no lugar (é do draft).
 * @param seconds Duração do trecho.
 * @returns true se o projétil continua no mapa; false se acabou.
 */
function flyProjectile(
  context: StepContext,
  projectile: SceneProjectile,
  seconds: number,
): boolean {
  const distance = Math.min(projectile.speed * seconds, projectile.remainingDistance);
  const start = { x: projectile.x, y: projectile.y };
  const end = {
    x: start.x + projectile.directionX * distance,
    y: start.y + projectile.directionY * distance,
  };
  const hitRadius = BALANCE.bodyRadius + BALANCE.projectileRadius;
  const targets = context.draft.enemies
    .filter((enemy) => !projectile.hitEnemyUids.includes(enemy.uid))
    .filter((enemy) => getDistanceToSegment(enemy, start, end) <= hitRadius)
    .sort((first, second) => getDistance(first, start) - getDistance(second, start));

  for (const enemy of targets) {
    projectile.hitEnemyUids.push(enemy.uid);
    damageEnemy(context, enemy, projectile.damage, projectile.isCrit);

    if (!projectile.isSpecial) {
      return false;
    }
  }

  projectile.x = end.x;
  projectile.y = end.y;
  projectile.remainingDistance -= distance;
  const isInsideWall = !isWalkablePosition(context.map, end.x, end.y, BALANCE.projectileRadius);
  return projectile.remainingDistance > EPSILON && !isInsideWall;
}


// =============================================================================
// =============================================================================
// G E O M E T R I A

// Posição da personagem como ponto
function getPlayer(draft: ExpeditionScene): Point {
  return { x: draft.playerX, y: draft.playerY };
}

// Centro de um ladrilho
function toTileCenter(column: number, row: number): Point {
  return { x: column + 0.5, y: row + 0.5 };
}

// Distância em linha reta entre dois pontos
function getDistance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

// Distância de um ponto até o trecho de reta entre "start" e "end"
function getDistanceToSegment(point: Point, start: Point, end: Point): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared <= EPSILON) {
    return getDistance(point, start);
  }

  const along = ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, along));
  return getDistance(point, { x: start.x + clamped * segmentX, y: start.y + clamped * segmentY });
}
