/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionScene.ts
 * O que faz: as regras da expedição em tempo real. Monta a cena de um mapa,
 * anda com a personagem respeitando árvores e água, faz as visagens
 * passearem, perseguirem e baterem, solta as ondas cada vez mais fortes,
 * cuida do golpe automático e do golpe especial, e diz quando a expedição
 * acaba (fim do tempo, vida zerada ou passagem de volta).
 *
 * O golpe comum é um projétil que voa na visagem mais perto e para na
 * primeira que acerta. Projétil some ao bater em árvore ou água, ou depois de
 * andar a distância máxima. O golpe especial é o de quem está em campo
 * (src/data/specials.ts): quem aplica é src/domain/expeditionSpecials.ts, que
 * também cuida dos estados que ele deixa nas visagens (lenta, sem a pista,
 * queimando).
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
 * Arquivos vizinhos: o voo e o acerto dos projéteis ficam em
 * src/domain/expeditionProjectiles.ts, os golpes especiais em
 * src/domain/expeditionSpecials.ts, as pegadas de Rastro em
 * src/domain/expeditionFootprints.ts, o nível e o dano das visagens em
 * src/domain/expeditionScaling.ts, e distâncias, colisão e ladrilhos livres em
 * src/domain/sceneGeometry.ts.
 *
 * Mapa:
 *   1. Constantes e tipos
 *   2. Funções públicas
 *   3. Passo da cena
 *   4. Personagem: movimento e passagem de volta
 *   5. Visagens: ondas, passeio, perseguição e encostada (bloco "Visagens")
 *   6. Golpes: automático e especial (os disparos e o dano na visagem)
 */

import { BALANCE } from '../data/balance';
import { pickRandom, rollChance } from '../utils/random';
import type { RandomSource } from '../utils/random';
import { getEnemy, getExpeditionMap } from './catalog';
import {
  copyTrailTargets,
  getFootprintInterval,
  maybeDropFootprint,
  updateFootprints,
} from './expeditionFootprints';
import { launchProjectile, updateProjectiles } from './expeditionProjectiles';
import {
  applyBurn,
  castSpecial,
  getSpecialCooldown,
  getSpeedMultiplier,
  isConfused,
  updateEnemyStatus,
} from './expeditionSpecials';
import { getEnemyContactDamage, getFighterBaseLevel, getWaveLevel } from './expeditionScaling';
import { getEnemyMaxHp } from './formulas';
import {
  getDistance,
  getPlayerPoint,
  isWalkablePosition,
  listFreeTileCenters,
  SCENE_EPSILON,
  toTileCenter,
} from './sceneGeometry';
import type { Point } from './sceneGeometry';
import type {
  ExpeditionFighter,
  ExpeditionInput,
  ExpeditionMapDef,
  ExpeditionOutcome,
  ExpeditionScene,
  MapKill,
  SceneEnemy,
  SceneEvent,
  SceneSetup,
  SceneStepResult,
} from './types';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

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
  trails: string[];
  events: SceneEvent[];
  outcome: ExpeditionOutcome | null;
  isSpecialPending: boolean; // o pedido de golpe especial vale uma vez por chamada
  // Tira vida de uma visagem e cuida da derrota (para os golpes especiais e a queimadura)
  damageEnemy: (enemy: SceneEnemy, damage: number) => void;
}


// =============================================================================
// =============================================================================
// F U N Ç Õ E S   P Ú B L I C A S

/**
 * Monta a cena do começo de uma expedição.
 *
 * O nível de partida (baseLevel) sai do dano de quem sai e fica fixo durante a
 * expedição inteira (src/domain/expeditionScaling.ts). Se a comitiva ficar mais
 * forte na clareira no meio da expedição, as visagens não mudam. A primeira
 * pegada surge na metade do intervalo normal, para aparecer logo.
 *
 * @param setup Mapa, quem sai (vida e dano), de quem são as pegadas e a chance de
 *              Rastro. Sem quem sai: vida playerBaseHp e nível de partida 1.
 * @param random Fonte de sorteio para o lugar e o tipo das primeiras visagens.
 * @returns Cena no tempo zero: personagem no início do mapa, olhando para a direita, com a vida
 *          cheia, golpe especial pronto, waveStartEnemies visagens longe dela e nenhuma pegada.
 * @throws Error se o mapa não existir.
 */
export function createExpeditionScene(setup: SceneSetup, random: RandomSource): ExpeditionScene {
  const { mapId, fighter } = setup;
  const map = getExpeditionMap(mapId);
  const start = toTileCenter(map.start.x, map.start.y);
  const maxHp = fighter?.maxHp ?? BALANCE.playerBaseHp;
  const footprintInterval = getFootprintInterval(setup.trailChance * setup.modifiers.footprintRate);
  const context = createContext(
    {
      mapId,
      baseLevel: getFighterBaseLevel(fighter?.damage ?? 0),
      elapsedSeconds: 0,
      playerX: start.x,
      playerY: start.y,
      playerHp: maxHp,
      playerMaxHp: maxHp,
      hurtSeconds: 0,
      invulnerableSeconds: 0,
      attackProgress: 0,
      specialCooldown: 0,
      specialCooldownTotal: getSpecialCooldown(
        fighter?.encantadoId ?? '',
        setup.modifiers.specialCooldown,
      ),
      facingX: 1,
      facingY: 0,
      enemies: [],
      projectiles: [],
      spawnTimer: BALANCE.waveSpawnSecondsStart,
      nextEnemyUid: 1,
      nextProjectileUid: 1,
      footprints: [],
      trailTargets: copyTrailTargets(setup.trailTargets),
      footprintTimer: footprintInterval / 2,
      footprintIntervalSeconds: footprintInterval,
      nextFootprintUid: 1,
      modifiers: { ...setup.modifiers },
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
 * acertam, as ondas trazem visagens novas, as pegadas são pegas ou surgem e o
 * fim do tempo é conferido.
 * Quando a expedição acaba, o resto do intervalo é ignorado.
 *
 * Função pura: não altera "scene" nem "input".
 *
 * @param scene Cena de partida. Não é alterada.
 * @param fighter Quem anda e bate. Null: a personagem anda, mas não bate.
 * @param input Direção (cada eixo de -1 a 1) e pedido de golpe especial.
 * @param seconds Quantos segundos de jogo simular.
 * @param random Fonte de sorteio (crítico, passeio e nascimento das visagens).
 * @returns Cena nova, visagens derrotadas, pegadas pegas (um encantado por Rastro),
 *          eventos para a tela e como a expedição terminou (null se ela continua).
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
    return { scene, kills: [], trails: [], events: [], outcome: null };
  }

  const context = createContext(structuredClone(scene), fighter, random);
  context.isSpecialPending = input.useSpecial;
  let remainingSeconds = seconds;

  while (remainingSeconds > SCENE_EPSILON && context.outcome === null) {
    const stepSeconds = Math.min(remainingSeconds, BALANCE.sceneMaxStepSeconds);
    runStep(context, input, stepSeconds);
    remainingSeconds -= stepSeconds;
  }

  return {
    scene: context.draft,
    kills: context.kills,
    trails: context.trails,
    events: context.events,
    outcome: context.outcome,
  };
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
  const context: StepContext = {
    draft,
    map: getExpeditionMap(draft.mapId),
    fighter,
    random,
    kills: [],
    trails: [],
    events: [],
    outcome: null,
    isSpecialPending: false,
    damageEnemy: (enemy, damage) => damageEnemy(context, enemy, damage, false),
  };
  return context;
}

// Um passo curto, na ordem descrita em advanceScene
function runStep(context: StepContext, input: ExpeditionInput, seconds: number): void {
  const { draft } = context;
  draft.elapsedSeconds += seconds;
  draft.hurtSeconds = Math.max(0, draft.hurtSeconds - seconds);
  draft.invulnerableSeconds = Math.max(0, draft.invulnerableSeconds - seconds);
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
  updateProjectiles(draft, context.map, seconds, (enemy, projectile) => {
    damageEnemy(context, enemy, projectile.damage, projectile.isCrit);
    applyBurn(enemy, projectile.burnDps, projectile.burnSeconds);
  });
  updateWaves(context, seconds);
  updateFootprints(context, seconds);

  if (draft.elapsedSeconds >= BALANCE.expeditionDurationSeconds - SCENE_EPSILON) {
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
  const distance = BALANCE.playerSpeed * draft.modifiers.playerSpeed * seconds;
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
  const maxEnemies = Math.round(
    (BALANCE.waveMaxEnemiesStart + extraEnemies) * draft.modifiers.maxEnemies,
  );

  draft.spawnTimer = Math.max(0, draft.spawnTimer - seconds);

  if (draft.spawnTimer > 0 || draft.enemies.length >= maxEnemies) {
    return;
  }

  spawnEnemy(context);
  const interval = Math.max(
    BALANCE.waveSpawnSecondsMin,
    BALANCE.waveSpawnSecondsStart - minutes * BALANCE.waveSpawnSpeedupPerMinute,
  );
  draft.spawnTimer = interval / draft.modifiers.spawnRate;
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
  const level = getWaveLevel(draft.baseLevel, map, draft.elapsedSeconds);
  const maxHp = getEnemyMaxHp(level, enemyDef, false);
  const enemy: SceneEnemy = {
    uid: draft.nextEnemyUid,
    enemyId,
    level,
    x: spot.x,
    y: spot.y,
    hp: maxHp,
    maxHp,
    damage: getEnemyContactDamage(draft.playerMaxHp, level, draft.baseLevel, enemyDef),
    hitCooldown: 0,
    targetX: spot.x,
    targetY: spot.y,
    waitSeconds: rollWaitSeconds(random),
    slowSeconds: 0,
    slowMultiplier: 1,
    confusedSeconds: 0,
    burnSeconds: 0,
    burnDps: 0,
    burnTickSeconds: 0,
  };

  draft.nextEnemyUid += 1;
  draft.enemies.push(enemy);
}

// Centro de um ladrilho livre, de preferência a enemyMinSpawnDistance da personagem
function pickSpawnSpot(context: StepContext): Point | null {
  const { draft, map, random } = context;
  const player = getPlayerPoint(draft);
  const freeSpots = listFreeTileCenters(map);
  const farSpots = freeSpots.filter(
    (spot) => getDistance(spot, player) >= BALANCE.enemyMinSpawnDistance,
  );
  const options = farSpots.length > 0 ? farSpots : freeSpots;
  return options.length > 0 ? pickRandom(options, random) : null;
}

// Perto da personagem, a visagem persegue e bate. Longe, ou sem a pista, passeia.
// Lenta, faz tudo mais devagar. Se a queimadura derrubar, para por aqui.
function updateEnemy(context: StepContext, enemy: SceneEnemy, seconds: number): void {
  const player = getPlayerPoint(context.draft);
  const distance = getDistance(enemy, player);
  enemy.hitCooldown = Math.max(0, enemy.hitCooldown - seconds);
  updateEnemyStatus(context, enemy, seconds);

  if (enemy.hp <= 0) {
    return;
  }

  const movingSeconds = seconds * getSpeedMultiplier(enemy);

  if (distance <= BALANCE.enemyAggroRange && !isConfused(enemy)) {
    chasePlayer(context, enemy, distance, movingSeconds);
    touchPlayer(context, enemy);
  } else {
    wander(context, enemy, movingSeconds);
  }
}

// Anda em direção à personagem, até encostar. Encostada em árvore, desliza pelo eixo livre.
function chasePlayer(
  context: StepContext,
  enemy: SceneEnemy,
  distance: number,
  seconds: number,
): void {
  const player = getPlayerPoint(context.draft);
  const stepLength = Math.min(
    BALANCE.enemyChaseSpeed * seconds,
    Math.max(0, distance - BALANCE.enemyContactRange * 0.8),
  );

  if (stepLength <= 0 || distance <= SCENE_EPSILON) {
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

// Encostada na personagem e fora da recarga, a visagem bate. No Redemoinho, não acerta.
function touchPlayer(context: StepContext, enemy: SceneEnemy): void {
  const { draft } = context;
  const distance = getDistance(enemy, getPlayerPoint(draft));

  if (
    distance > BALANCE.enemyContactRange ||
    enemy.hitCooldown > 0 ||
    draft.invulnerableSeconds > 0
  ) {
    return;
  }

  const damage = Math.max(1, Math.ceil(enemy.damage * draft.modifiers.damageTaken));
  draft.playerHp = Math.max(0, draft.playerHp - damage);
  draft.hurtSeconds = BALANCE.hurtFlashSeconds;
  enemy.hitCooldown = BALANCE.enemyHitCooldownSeconds;
  context.events.push({ type: 'hurt', x: draft.playerX, y: draft.playerY, damage });
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

  if (draft.attackProgress < 1 - SCENE_EPSILON) {
    return;
  }

  const target = findNearestEnemy(draft, BALANCE.attackRange);

  if (target === null) {
    return;
  }

  const player = getPlayerPoint(draft);
  const isCrit = rollChance(fighter.critChance, context.random);
  draft.attackProgress = 0;
  launchProjectile(draft, {
    isSpecial: false,
    direction: { x: target.x - player.x, y: target.y - player.y },
    speed: BALANCE.projectileSpeed,
    maxDistance: BALANCE.projectileMaxDistance,
    damage: isCrit ? fighter.damage * BALANCE.critMultiplier : fighter.damage,
    isCrit,
  });
}

// Golpe especial de quem está em campo (src/domain/expeditionSpecials.ts). Só se pedido e pronto.
function fireSpecialIfPending(context: StepContext): void {
  const { draft, fighter } = context;
  const isRequested = context.isSpecialPending;
  context.isSpecialPending = false;

  if (!isRequested || draft.specialCooldown > 0 || fighter === null) {
    return;
  }

  castSpecial(context, fighter);
  draft.specialCooldownTotal = draft.specialCooldown;
}

// Visagem mais perto da personagem dentro da distância pedida, ou null
function findNearestEnemy(draft: ExpeditionScene, range: number): SceneEnemy | null {
  const player = getPlayerPoint(draft);
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

  if (enemy.hp <= 0) {
    return; // já derrotada neste passo (por exemplo, pela queimadura)
  }

  enemy.hp = Math.max(0, enemy.hp - damage);
  context.events.push({ type: 'hit', x: enemy.x, y: enemy.y, damage, isCrit });

  if (enemy.hp > 0) {
    return;
  }

  draft.enemies = draft.enemies.filter((candidate) => candidate.uid !== enemy.uid);
  context.kills.push({ enemyId: enemy.enemyId, stage: enemy.level, zoneId: map.zoneId });
  context.events.push({ type: 'defeat', x: enemy.x, y: enemy.y, enemyId: enemy.enemyId });
  maybeDropFootprint(context, { x: enemy.x, y: enemy.y });
}
