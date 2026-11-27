/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/expeditionTeam.ts
 * O que faz: o revezamento da expedição. Quem sai são até três encantados da
 * comitiva, um em campo por vez. A pessoa troca pelas teclas 1, 2 e 3, com uma
 * recarga entre trocas. Cada um tem a própria vida e o próprio golpe especial.
 * Quem cai fica fora até o fim, e o próximo entra sozinho. A expedição só
 * termina em "caiu" quando os três caem.
 *
 * Decidido em 27/11/2026 (Caminho 2, estudo da comitiva).
 *
 * Como a cena guarda o time: os campos de quem está em campo (vida, vida
 * máxima, recarga do especial) ficam no topo da cena (playerHp, playerMaxHp,
 * specialCooldown, specialCooldownTotal), porque é com eles que o passo
 * trabalha. Os outros ficam em scene.team. Ao trocar, quem sai de campo é
 * guardado em team e quem entra é copiado para o topo. syncActiveMember deixa
 * team[activeIndex] em dia com o topo, e advanceScene chama no fim.
 *
 * Quem usa: src/domain/expeditionScene.ts.
 *
 * Pureza: as funções alteram só a cena de trabalho (o "draft" de advanceScene)
 * e as listas do contexto do passo, como o resto do passo da cena.
 *
 * Mapa:
 *   1. Tipos
 *   2. Montar o time
 *   3. Trocar e cair
 *   4. Ajudantes
 */

import { BALANCE } from '../data/balance';
import { getSpecialCooldown } from './expeditionSpecials';
import type {
  ExpeditionFighter,
  ExpeditionScene,
  SceneEvent,
  SceneSetup,
  SceneTeamMember,
} from './types';

// =============================================================================
// =============================================================================
// T I P O S

// O que o revezamento precisa do passo. O StepContext de expeditionScene.ts serve.
export interface TeamContext {
  draft: ExpeditionScene;
  events: SceneEvent[];
  fighters: readonly ExpeditionFighter[]; // na mesma ordem de draft.team
  fighter: ExpeditionFighter | null; // quem está em campo (fighters[activeIndex])
}


// =============================================================================
// =============================================================================
// M O N T A R   O   T I M E

/**
 * O time do começo da expedição: todos com a vida cheia e o golpe pronto.
 *
 * @param fighters Quem sai, na ordem em que revezam.
 * @param cooldownMultiplier Recarga do especial da partida (preparo "Brasa no bornal").
 * @returns Um membro por encantado, nenhum caído.
 */
export function createTeam(
  fighters: SceneSetup['fighters'],
  cooldownMultiplier: number,
): SceneTeamMember[] {
  return fighters.map((fighter) => {
    const total = getSpecialCooldown(fighter.encantadoId, cooldownMultiplier);
    return {
      encantadoId: fighter.encantadoId,
      hp: fighter.maxHp,
      maxHp: fighter.maxHp,
      specialCooldown: 0,
      specialCooldownTotal: total,
      isDown: false,
    };
  });
}

// Deixa team[activeIndex] igual aos campos de quem está em campo, no topo da cena
export function syncActiveMember(draft: ExpeditionScene): void {
  const member = draft.team[draft.activeIndex];

  if (member === undefined) {
    return;
  }

  member.hp = Math.max(0, draft.playerHp);
  member.maxHp = draft.playerMaxHp;
  member.specialCooldown = draft.specialCooldown;
  member.specialCooldownTotal = draft.specialCooldownTotal;
}

// O tempo corre fora de campo: a recarga da troca e o golpe de quem espera a vez
export function updateBench(draft: ExpeditionScene, seconds: number): void {
  draft.swapCooldown = Math.max(0, draft.swapCooldown - seconds);

  draft.team.forEach((member, index) => {
    if (index !== draft.activeIndex) {
      member.specialCooldown = Math.max(0, member.specialCooldown - seconds);
    }
  });
}


// =============================================================================
// =============================================================================
// T R O C A R   E   C A I R

// Dá para pôr em campo quem está nesta posição agora
export function canSwapTo(draft: ExpeditionScene, index: number): boolean {
  const member = draft.team[index];
  return (
    member !== undefined &&
    !member.isDown &&
    index !== draft.activeIndex &&
    draft.swapCooldown <= 0
  );
}

/**
 * Troca quem está em campo, se der (canSwapTo). Começa a recarga da troca.
 *
 * Quem entra começa com a barra do golpe comum vazia e sem piscar. Quem sai
 * guarda a vida e a recarga do especial, que continua andando fora de campo.
 *
 * @param context Contexto do passo. Altera o draft, o fighter e a lista de eventos.
 * @param index Posição em team de quem entra.
 * @returns true se trocou.
 */
export function swapTo(context: TeamContext, index: number): boolean {
  if (!canSwapTo(context.draft, index)) {
    return false;
  }

  bringIn(context, index);
  context.draft.swapCooldown = BALANCE.swapCooldownSeconds;
  return true;
}

/**
 * Quem estava em campo caiu: fica fora até o fim e o próximo de pé entra sozinho
 * (o seguinte na ordem, dando a volta). Quem entra fica fallInvulnerableSeconds
 * sem levar golpe. A recarga da troca não muda.
 *
 * @param context Contexto do passo. Altera o draft, o fighter e a lista de eventos.
 * @returns true se alguém entrou. False se não sobrou ninguém de pé (a expedição acabou).
 */
export function replaceFallen(context: TeamContext): boolean {
  const { draft } = context;
  const fallen = draft.team[draft.activeIndex];

  if (fallen !== undefined) {
    syncActiveMember(draft);
    fallen.isDown = true;
    context.events.push({
      type: 'fall',
      x: draft.playerX,
      y: draft.playerY,
      encantadoId: fallen.encantadoId,
    });
  }

  const next = findNextStanding(draft);

  if (next === null) {
    return false;
  }

  bringIn(context, next);
  draft.invulnerableSeconds = Math.max(draft.invulnerableSeconds, BALANCE.fallInvulnerableSeconds);
  return true;
}

// Encantados que caíram nesta cena, na ordem em que saíram
export function getFallenIds(scene: ExpeditionScene): string[] {
  return scene.team.filter((member) => member.isDown).map((member) => member.encantadoId);
}


// =============================================================================
// =============================================================================
// A J U D A N T E S

// Guarda quem está em campo e põe "index" no lugar dele, com aviso para a tela
function bringIn(context: TeamContext, index: number): void {
  const { draft } = context;
  const member = draft.team[index];

  if (member === undefined) {
    return;
  }

  syncActiveMember(draft);
  draft.activeIndex = index;
  draft.playerHp = member.hp;
  draft.playerMaxHp = member.maxHp;
  draft.specialCooldown = member.specialCooldown;
  draft.specialCooldownTotal = member.specialCooldownTotal;
  draft.attackProgress = 0;
  draft.hurtSeconds = 0;
  context.fighter = context.fighters[index] ?? null;
  context.events.push({
    type: 'swap',
    x: draft.playerX,
    y: draft.playerY,
    encantadoId: member.encantadoId,
  });
}

// Próximo de pé depois de quem está em campo, dando a volta. Null se todos caíram.
function findNextStanding(draft: ExpeditionScene): number | null {
  const size = draft.team.length;

  for (let step = 1; step < size; step += 1) {
    const index = (draft.activeIndex + step) % size;

    if (draft.team[index]?.isDown === false) {
      return index;
    }
  }
  return null;
}
