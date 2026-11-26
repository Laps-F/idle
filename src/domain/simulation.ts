/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/simulation.ts
 * O que faz: avança o combate por um intervalo de tempo qualquer. É o coração
 * do motor. A mesma função serve para o tick de 0,1 s e para horas de
 * ausência, porque ela pula de evento em evento (próximo golpe ou fim do
 * tempo do chefe) em vez de andar em passos fixos.
 *
 * As recompensas de cada derrota (Patacas, XP, Oferendas, Rastros, amuleto e
 * compra automática) ficam em src/domain/rewards.ts, que a expedição também usa.
 *
 * Pureza: advanceSimulation e dealDirectDamage são funções puras. Elas não
 * alteram o estado recebido, não leem o relógio e não sorteiam por conta
 * própria (o sorteio entra por parâmetro). Por dentro, trabalham em uma cópia
 * privada do estado, o "draft". As funções internas deste arquivo alteram só
 * essa cópia, que nunca sai daqui antes de a simulação terminar.
 *
 * Mapa:
 *   1. Constantes e tipos
 *   2. Funções públicas (puras)
 *   3. Tempo: próximo evento e relógios
 *   4. Golpes
 *   5. Derrota de inimigos e chefes
 */

import { BALANCE, MS_PER_SECOND } from '../data/balance';
import { rollChance } from '../utils/random';
import { getEncantado, getEnemy, getZoneForStage } from './catalog';
import { getAttackDamage, getAttackInterval } from './formulas';
import { getBossTimeLimit } from './juazeiro';
import {
  createRewardContext,
  emit,
  getCurrentModifiers,
  grantKillRewards,
  toResult,
} from './rewards';
import type { RewardContext, SimulationOptions } from './rewards';
import { createBossCombat, createCommonEnemyCombat, createEmptySummary } from './state';
import type { GameState, Modifiers, SimulationResult } from './types';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

// Folga para erro de arredondamento ao comparar tempos e progressos
const TIME_EPSILON = 1e-9;

// Passo mínimo, para a simulação sempre andar mesmo com arredondamento
const MIN_STEP_SECONDS = 1e-6;

// Trava de segurança: nenhum trecho simulado passa deste número de eventos
const MAX_ITERATIONS = 5_000_000;

// Nome de quem bate nos eventos de golpe que não vêm de um encantado
export const DIRECT_ATTACKER_ID = 'manual';

// As opções de um trecho simulado são as mesmas das recompensas (src/domain/rewards.ts)
export type { SimulationOptions } from './rewards';

// Um golpe já calculado: quem bateu, quanto tirou e se foi crítico
interface Hit {
  attackerId: string;
  damage: number;
  isCrit: boolean;
}

// O contexto de um trecho simulado é o mesmo das recompensas: a cópia privada do
// estado (o "draft"), o resumo, os eventos, o sorteio e o instante atual
type SimulationContext = RewardContext;


// =============================================================================
// =============================================================================
// F U N Ç Õ E S   P Ú B L I C A S

/**
 * Simula um intervalo de combate e devolve o estado resultante.
 *
 * Algoritmo: em vez de andar em passos fixos, a simulação calcula quanto falta
 * para o próximo evento (o próximo golpe de algum encantado ou o fim do tempo
 * do chefe), pula direto para ele e resolve o que ficou pronto. Por isso o
 * resultado é o mesmo em um passo de 120 s ou em 1.200 passos de 0,1 s.
 *
 * Função pura: não altera "state". Com a mesma fonte de sorteio, devolve
 * sempre o mesmo resultado.
 *
 * @param state Estado de partida. Não é alterado.
 * @param seconds Quantos segundos de jogo simular.
 * @param options Instante de início, fonte de sorteio e opções do trecho.
 * @returns Estado novo, resumo do que aconteceu e os eventos (se pedidos).
 *
 * Casos de borda:
 * - Sem comitiva, ou com "seconds" zero, negativo ou NaN: devolve o mesmo
 *   "state" recebido, com o resumo zerado. Nada é simulado.
 * - A marca de tempo (lastSaveTimestamp) não é alterada. Quem chama decide o valor.
 * - Há uma trava de 5 milhões de eventos por chamada. Se for atingida, o tempo
 *   que sobrar é descartado e "summary.seconds" mostra quanto foi simulado.
 * - Os multiplicadores são calculados no começo e de novo quando a compra
 *   automática de melhorias compra algo. A virada de dia para noite vale a
 *   partir do primeiro evento depois dela.
 */
export function advanceSimulation(
  state: GameState,
  seconds: number,
  options: SimulationOptions,
): SimulationResult {
  const canSimulate = state.party.length > 0 && seconds > 0;

  if (!canSimulate) {
    return { state, summary: createEmptySummary(), events: [] };
  }

  const context = createRewardContext(state, options);
  const clockMsPerSecond = options.clockMsPerSecond ?? MS_PER_SECOND;
  let remainingSeconds = seconds;
  let iterations = 0;

  while (remainingSeconds > TIME_EPSILON && iterations < MAX_ITERATIONS) {
    const stepSeconds = runNextStep(context, remainingSeconds);
    context.timestamp += stepSeconds * clockMsPerSecond;
    remainingSeconds -= stepSeconds;
    iterations += 1;
  }

  const simulatedSeconds = seconds - Math.max(remainingSeconds, 0);
  context.summary.seconds = simulatedSeconds;
  context.draft.stats.playTimeSeconds += simulatedSeconds;
  context.draft.editionSeconds += simulatedSeconds;
  return toResult(context);
}

/**
 * Causa dano direto no inimigo em campo, fora do ritmo dos ataques.
 *
 * Usado para clique e para teste. Se a vida zerar, a derrota segue o caminho
 * normal: entrega Patacas, XP, itens e Rastros e coloca o próximo inimigo em campo.
 *
 * Função pura: não altera "state".
 *
 * @param state Estado de partida. Não é alterado.
 * @param damage Dano a aplicar. Não passa pelo crítico nem pelos multiplicadores.
 * @param options Instante atual e fonte de sorteio.
 * @returns Estado novo, resumo e eventos (se pedidos).
 *
 * Casos de borda: dano zero, negativo ou NaN devolve o mesmo "state" recebido.
 * Dano maior que a vida restante não passa para o próximo inimigo.
 */
export function dealDirectDamage(
  state: GameState,
  damage: number,
  options: SimulationOptions,
): SimulationResult {
  if (!(damage > 0)) {
    return { state, summary: createEmptySummary(), events: [] };
  }

  const context = createRewardContext(state, options);
  const modifiers = getCurrentModifiers(context);

  applyDamage(context, { attackerId: DIRECT_ATTACKER_ID, damage, isCrit: false }, modifiers);
  return toResult(context);
}


// =============================================================================
// =============================================================================
// T E M P O

// Anda até o próximo evento, resolve o que ficou pronto e devolve quanto tempo passou
function runNextStep(context: SimulationContext, remainingSeconds: number): number {
  const modifiers = getCurrentModifiers(context);
  const secondsToNextEvent = getSecondsToNextEvent(context.draft, modifiers);
  const stepSeconds = Math.min(remainingSeconds, secondsToNextEvent);

  advanceTimers(context.draft, modifiers, stepSeconds);
  resolveReadyAttacks(context, modifiers);
  resolveBossTimeout(context);
  return stepSeconds;
}

// Segundos até o próximo golpe ou até acabar o tempo do chefe, o que vier antes
function getSecondsToNextEvent(draft: GameState, modifiers: Modifiers): number {
  let secondsToNextEvent = Infinity;

  for (const encantadoId of draft.party) {
    const interval = getAttackInterval(getEncantado(encantadoId), modifiers);
    const progress = draft.combat.attackProgress[encantadoId] ?? 0;
    secondsToNextEvent = Math.min(secondsToNextEvent, (1 - progress) * interval);
  }

  if (draft.combat.isBoss) {
    secondsToNextEvent = Math.min(secondsToNextEvent, draft.combat.bossTimeLeft);
  }

  return Math.max(secondsToNextEvent, MIN_STEP_SECONDS);
}

// Enche as barras de ataque e desconta o tempo do chefe
function advanceTimers(draft: GameState, modifiers: Modifiers, stepSeconds: number): void {
  for (const encantadoId of draft.party) {
    const interval = getAttackInterval(getEncantado(encantadoId), modifiers);
    const progress = draft.combat.attackProgress[encantadoId] ?? 0;
    draft.combat.attackProgress[encantadoId] = progress + stepSeconds / interval;
  }

  if (draft.combat.isBoss) {
    draft.combat.bossTimeLeft -= stepSeconds;
  }
}


// =============================================================================
// =============================================================================
// G O L P E S

// Dispara o golpe de cada encantado cuja barra encheu
function resolveReadyAttacks(context: SimulationContext, modifiers: Modifiers): void {
  const { draft } = context;

  for (const encantadoId of draft.party) {
    const isReady = (draft.combat.attackProgress[encantadoId] ?? 0) >= 1 - TIME_EPSILON;

    if (isReady) {
      draft.combat.attackProgress[encantadoId] = 0;
      performAttack(context, encantadoId, modifiers);
    }
  }
}

// Calcula o golpe de um encantado, com chance de crítico, e aplica no inimigo
function performAttack(
  context: SimulationContext,
  encantadoId: string,
  modifiers: Modifiers,
): void {
  const { draft, random } = context;
  const owned = draft.roster[encantadoId];

  // Comitiva com alguém fora do elenco não deveria existir. Se existir, o golpe é ignorado.
  if (owned === undefined) {
    return;
  }

  const encantado = getEncantado(encantadoId);
  const baseDamage = getAttackDamage(encantado, owned.level, modifiers, draft.combat.isBoss);
  const isCrit = rollChance(modifiers.critChance, random);
  const damage = isCrit ? baseDamage * BALANCE.critMultiplier : baseDamage;

  applyDamage(context, { attackerId: encantadoId, damage, isCrit }, modifiers);
}

// Tira vida do inimigo e, se ela zerar, resolve a derrota
function applyDamage(context: SimulationContext, hit: Hit, modifiers: Modifiers): void {
  const { draft } = context;

  draft.combat.enemyHp = Math.max(0, draft.combat.enemyHp - hit.damage);
  emit(context, { type: 'hit', ...hit });

  if (draft.combat.enemyHp <= 0) {
    handleEnemyDefeated(context, modifiers);
  }
}


// =============================================================================
// =============================================================================
// D E R R O T A   D E   I N I M I G O S   E   C H E F E S

// Entrega as recompensas e decide quem entra em campo depois
function handleEnemyDefeated(context: SimulationContext, modifiers: Modifiers): void {
  const { combat } = context.draft;
  const wasBoss = combat.isBoss;

  const target = {
    enemy: getEnemy(combat.enemyId),
    stage: context.draft.stage,
    isBoss: wasBoss,
    zone: getZoneForStage(context.draft.stage),
  };
  grantKillRewards(context, target, modifiers);

  if (wasBoss) {
    handleBossDefeated(context);
  } else {
    handleCommonEnemyDefeated(context);
  }
}

// Conta a visagem derrotada e chama o chefe quando a contagem fecha
function handleCommonEnemyDefeated(context: SimulationContext): void {
  const { draft } = context;
  const zone = getZoneForStage(draft.stage);

  draft.killsInStage = Math.min(draft.killsInStage + 1, zone.killsToBoss);
  const isBossDue = draft.autoProgress && draft.killsInStage >= zone.killsToBoss;

  if (isBossDue) {
    const timeLimit = getBossTimeLimit(draft);
    draft.combat = createBossCombat(draft.stage, draft.combat.attackProgress, timeLimit);
    emit(context, { type: 'bossAppeared', enemyId: zone.bossId });
  } else {
    spawnCommonEnemy(context);
  }
}

// Libera o próximo estágio e avança se o avanço automático estiver ligado
function handleBossDefeated(context: SimulationContext): void {
  const { draft, summary } = context;

  summary.bossesDefeated += 1;
  draft.stats.bossesDefeated += 1;
  draft.maxStage = Math.max(draft.maxStage, draft.stage + 1);
  draft.killsInStage = 0;

  if (draft.autoProgress) {
    draft.stage += 1;
    summary.stagesAdvanced += 1;
    emit(context, { type: 'stageAdvanced', stage: draft.stage });
  }

  spawnCommonEnemy(context);
}

// Se o tempo do chefe acabou com ele vivo, a comitiva volta a juntar visagens
function resolveBossTimeout(context: SimulationContext): void {
  const { draft, summary } = context;
  const hasTimedOut = draft.combat.isBoss && draft.combat.bossTimeLeft <= TIME_EPSILON;

  if (!hasTimedOut) {
    return;
  }

  summary.bossesFailed += 1;
  draft.stats.bossesFailed += 1;
  draft.killsInStage = 0;
  emit(context, { type: 'bossFailed', enemyId: draft.combat.enemyId });
  spawnCommonEnemy(context);
}

// Coloca em campo uma visagem sorteada, mantendo as barras de ataque
function spawnCommonEnemy(context: SimulationContext): void {
  const { draft, random } = context;
  draft.combat = createCommonEnemyCombat(draft.stage, draft.combat.attackProgress, random);
}
