/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/calibration.test.ts
 * O que faz: a medição da calibragem da expedição (Caminho 2, passo 6). Um robô
 * joga expedições com jogos de 5, 20 e 60 minutos de clareira, sozinho e com a
 * comitiva de três, nos dois mapas, e mostra uma tabela com quanto tempo
 * aguentou, quantas expedições chegaram ao fim, quantas visagens, e quanto a
 * bolsa rendeu perto do que a clareira renderia no mesmo tempo.
 *
 * Não roda com o npm test (leva uns 15 segundos). Para rodar:
 *   npm run calibrate
 *
 * O robô: foge das visagens que chegam perto, chega mais perto quando não há
 * visagem no alcance, solta o golpe especial com visagem perto (a Iara, com a
 * vida abaixo de 60%) e troca para quem tem mais vida quando a vida cai abaixo
 * de 35%. Joga pior que uma pessoa atenta: mata menos e foge mais.
 *
 * Como ler a tabela: "bolsa" é a mediana de Patacas da bolsa ÷ Patacas que a
 * clareira renderia no mesmo tempo (antes da garantia). "completas" é a mesma
 * conta só das expedições que chegaram ao fim. "piso" conta quantas precisaram
 * da garantia.
 *
 * Mapa:
 *   1. Montagem
 *   2. Robô
 *   3. Uma expedição
 *   4. Medição
 */

import { describe, it } from 'vitest';

import { UPGRADES } from '../src/data/upgrades';
import { buyUpgrade, chooseStarter } from '../src/domain/actions';
import {
  addKillsToLoot,
  addTrailsToLoot,
  finishExpedition,
  getExpeditionFighters,
  getSceneSetup,
  startExpedition,
} from '../src/domain/expedition';
import { advanceScene, createExpeditionScene } from '../src/domain/expeditionScene';
import { getFallenIds } from '../src/domain/expeditionTeam';
import { advanceSimulation } from '../src/domain/simulation';
import { createInitialState } from '../src/domain/state';
import type {
  ExpeditionInput,
  ExpeditionOutcome,
  ExpeditionScene,
  GameState,
} from '../src/domain/types';
import { createSeededRandom } from '../src/utils/random';

// =============================================================================
// =============================================================================
// M O N T A G E M

const START = Date.UTC(2026, 10, 26, 15, 0, 0); // de dia, para o Boitatá não entrar nas pegadas
const MINUTES_OF_PLAY = [5, 20, 60];
const MAP_IDS = ['beira-da-mata', 'brejo-escuro'];
const RUNS_PER_CASE = 20;
const STEP_SECONDS = 0.1;

// Só roda no modo "calibrate" do Vitest (npm run calibrate), e não no npm test.
// Assim funciona igual no Windows, no Mac e no Linux, sem variável de ambiente.
const isCalibrating = import.meta.env.MODE === 'calibrate';

// Jogo com o Saci depois de "minutes" de clareira, comprando toda melhoria que der
function growGame(minutes: number): { state: GameState; now: number } {
  const random = createSeededRandom(11);
  let now = START;
  let state = chooseStarter(createInitialState(now, random), 'saci');

  if (state === null) {
    throw new Error('O Saci deveria ser um encantado inicial.');
  }

  for (let second = 0; second < minutes * 60; second += 1) {
    state = advanceSimulation(state, 1, { random, startTimestamp: now }).state;
    now += 1000;
    state = buyEverything(state);
  }
  return { state, now };
}

// Compra melhorias até não dar mais
function buyEverything(state: GameState): GameState {
  let current = state;
  let hasBought = true;

  while (hasBought) {
    hasBought = false;
    for (const upgrade of UPGRADES) {
      const next = buyUpgrade(current, upgrade.id);
      if (next !== null) {
        current = next;
        hasBought = true;
      }
    }
  }
  return current;
}

// A mesma clareira com Iara e Curupira no nível do Saci, na comitiva
function withTrio(state: GameState): GameState {
  const level = state.roster.saci?.level ?? 1;
  const owned = (id: string) => ({ id, level, xp: 0, bond: 0 });
  return {
    ...state,
    roster: { ...state.roster, iara: owned('iara'), curupira: owned('curupira') },
    party: ['saci', 'iara', 'curupira'],
  };
}


// =============================================================================
// =============================================================================
// R O B Ô

// O que o robô aperta neste instante (regras no cabeçalho)
function playBot(scene: ExpeditionScene): ExpeditionInput {
  const hpFraction = scene.playerHp / scene.playerMaxHp;
  const activeId = scene.team[scene.activeIndex]?.encantadoId;
  let awayX = 0;
  let awayY = 0;
  let nearest = Infinity;
  let towardX = 0;
  let towardY = 0;

  for (const enemy of scene.enemies) {
    const dx = enemy.x - scene.playerX;
    const dy = enemy.y - scene.playerY;
    const distance = Math.hypot(dx, dy);

    if (distance < nearest) {
      nearest = distance;
      towardX = dx;
      towardY = dy;
    }
    if (distance < 2.5 && distance > 0) {
      awayX -= dx / (distance * distance);
      awayY -= dy / (distance * distance);
    }
  }
  if (scene.playerX < 4) {
    awayX += 2; // longe da passagem de volta
  }

  const useSpecial = activeId === 'iara' ? hpFraction < 0.6 : nearest < 3;
  const swapTo = hpFraction < 0.35 ? pickHealthiest(scene) : null;
  const awayLength = Math.hypot(awayX, awayY);

  if (awayLength > 1e-6) {
    return { moveX: awayX / awayLength, moveY: awayY / awayLength, useSpecial, swapTo };
  }

  const approachFrom = hpFraction > 0.5 ? 3 : 3.8;
  if (nearest > approachFrom && nearest < Infinity) {
    return { moveX: towardX / nearest, moveY: towardY / nearest, useSpecial, swapTo };
  }
  return { moveX: 0, moveY: 0, useSpecial, swapTo };
}

// De pé, fora de campo e com mais de metade da vida: quem tem mais vida. Null se ninguém.
function pickHealthiest(scene: ExpeditionScene): number | null {
  let bestIndex: number | null = null;
  let bestFraction = 0.5;

  scene.team.forEach((member, index) => {
    const fraction = member.hp / member.maxHp;
    if (!member.isDown && index !== scene.activeIndex && fraction > bestFraction) {
      bestFraction = fraction;
      bestIndex = index;
    }
  });
  return bestIndex;
}


// =============================================================================
// =============================================================================
// U M A   E X P E D I Ç Ã O

interface RunResult {
  outcome: ExpeditionOutcome;
  seconds: number;
  kills: number;
  bagRatio: number; // Patacas da bolsa ÷ Patacas da clareira no mesmo tempo
}

// Joga uma expedição do começo ao fim e entrega a bolsa
function playExpedition(base: GameState, now: number, mapId: string, seed: number): RunResult {
  const random = createSeededRandom(seed);
  let state = startExpedition(base, mapId);
  const setup = state === null ? null : getSceneSetup(state, now);

  if (state === null || setup === null) {
    throw new Error('Deveria partir.');
  }

  let scene = createExpeditionScene(setup, random);
  const fighters = getExpeditionFighters(state, now);
  let outcome: ExpeditionOutcome | null = null;

  while (outcome === null) {
    const step = advanceScene(scene, fighters, playBot(scene), STEP_SECONDS, random);
    scene = step.scene;
    state = addTrailsToLoot(addKillsToLoot(state, step.kills), step.trails);
    outcome = step.outcome;
  }

  const options = { startTimestamp: now, random };
  const fallen = getFallenIds(scene);
  const { report } = finishExpedition(state, outcome, scene.elapsedSeconds, options, fallen);
  const bagGold = (report?.summary.gold ?? 0) - (report?.guaranteeGold ?? 0);

  return {
    outcome,
    seconds: scene.elapsedSeconds,
    kills: report?.kills ?? 0,
    bagRatio: bagGold / Math.max(1, report?.clearingGold ?? 0),
  };
}


// =============================================================================
// =============================================================================
// M E D I Ç Ã O

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// Uma linha da tabela para um caso
function describeCase(label: string, results: readonly RunResult[]): string {
  const complete = results.filter((result) => result.outcome === 'concluida');
  const completeRatio = complete.length > 0 ? median(complete.map((r) => r.bagRatio)) : NaN;
  return [
    label.padEnd(30),
    `tempo ${Math.round(median(results.map((r) => r.seconds)))} s`.padEnd(12),
    `completas ${complete.length}/${results.length}`.padEnd(16),
    `visagens ${median(results.map((r) => r.kills))}`.padEnd(13),
    `bolsa ${median(results.map((r) => r.bagRatio)).toFixed(2)}x`.padEnd(13),
    `completas ${Number.isNaN(completeRatio) ? '-' : completeRatio.toFixed(2) + 'x'}`.padEnd(16),
    `piso ${results.filter((r) => r.bagRatio < 1).length}`,
  ].join(' ');
}

describe.skipIf(!isCalibrating)('calibragem da expedição', () => {
  it('mede tempo, fim e saque perto da clareira', () => {
    const lines: string[] = [];

    for (const minutes of MINUTES_OF_PLAY) {
      const { state, now } = growGame(minutes);
      const cases = [
        { name: 'sozinho', game: state },
        { name: 'trio', game: withTrio(state) },
      ];

      for (const { name, game } of cases) {
        for (const mapId of MAP_IDS) {
          const seeds = Array.from({ length: RUNS_PER_CASE }, (_, index) => 100 + index);
          const results = seeds.map((seed) => playExpedition(game, now, mapId, seed));
          lines.push(describeCase(`${minutes} min ${name} ${mapId}`, results));
        }
      }
    }

    console.log(`\n${lines.join('\n')}\n`);
  }, 600_000);
});
