/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/expeditionSession.ts
 * O que faz: a parte da store que cuida da expedição: as ações de partir,
 * andar, golpe especial e voltar, o passo do mapa dentro do tick e a entrega
 * da bolsa na volta. As regras ficam em src/domain/expedition.ts e
 * src/domain/expeditionScene.ts. Aqui só se liga a entrada à regra e se grava.
 *
 * Quem usa: src/store/useGameStore.ts, que junta estas ações às outras e chama
 * runExpeditionTick e endExpedition dentro do tick.
 *
 * Mapa:
 *   1. Ações de expedição
 *   2. Passo do mapa e volta para a clareira
 */

import { BALANCE } from '../data/balance';
import {
  addKillsToLoot,
  finishExpedition,
  getExpeditionFighter,
  startExpedition,
} from '../domain/expedition';
import { advanceScene, createExpeditionScene } from '../domain/expeditionScene';
import { pickGameState } from '../domain/state';
import type { ExpeditionOutcome } from '../domain/types';
import { applyInput, commitState, NO_INPUT, NO_SCENE_EVENTS } from './storeTools';
import type { GetStore, SetStore } from './storeTools';
import type { GameActions } from './types';

// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   E X P E D I Ç Ã O

export type ExpeditionActions = Pick<
  GameActions,
  | 'startExpedition'
  | 'leaveExpedition'
  | 'setMoveInput'
  | 'triggerSpecial'
  | 'dismissExpeditionReport'
>;

// Partir, andar, golpe especial e voltar. As regras estão em src/domain/expedition.ts.
export function createExpeditionActions(set: SetStore, get: GetStore): ExpeditionActions {
  return {
    /**
     * Parte em expedição com o primeiro encantado da comitiva e monta a cena do mapa.
     *
     * @param mapId Mapa da expedição (src/data/world.ts).
     * @returns true se partiu. False sem comitiva, já em expedição ou com mapa que não existe.
     */
    startExpedition: (mapId) =>
      applyInput(
        set,
        get,
        (state) => startExpedition(state, mapId),
        (_previous, next) => ({
          expeditionScene: createExpeditionScene(
            mapId,
            getExpeditionFighter(next, Date.now())?.maxHp ?? BALANCE.playerBaseHp,
            Math.random,
          ),
          moveInput: NO_INPUT,
          isSpecialPending: false,
          sceneEvents: NO_SCENE_EVENTS,
          expeditionReport: null,
        }),
      ),

    /**
     * Volta para a clareira agora, sem esperar a passagem. Entrega a bolsa sem bônus.
     *
     * @returns true se havia expedição em andamento.
     */
    leaveExpedition: () => {
      if (get().isOpenInAnotherTab || get().expedition === null) {
        return false;
      }

      const now = Date.now();
      get().tick(now);
      return endExpedition(set, get, 'voltou', now);
    },

    // Guarda a direção apertada. Só grava quando muda, para não redesenhar à toa.
    setMoveInput: (input) => {
      const current = get().moveInput;

      if (current.moveX !== input.moveX || current.moveY !== input.moveY) {
        set({ moveInput: { moveX: input.moveX, moveY: input.moveY } });
      }
    },

    // Pede o golpe especial. Ele sai no próximo tick, se estiver pronto.
    triggerSpecial: () => {
      if (get().expedition !== null) {
        set({ isSpecialPending: true });
      }
    },

    dismissExpeditionReport: () => set({ expeditionReport: null }),
  };
}


// =============================================================================
// =============================================================================
// P A S S O   D O   M A P A   E   V O L T A   P A R A   A   C L A R E I R A

/**
 * Um passo da expedição, depois do passo da clareira.
 *
 * Anda com a cena pelo tempo que passou, guarda as derrotas na bolsa e, se a
 * expedição acabou (fim do tempo, vida zerada ou passagem de volta), entrega a bolsa.
 *
 * @param set Função de gravação da store.
 * @param get Função de leitura da store.
 * @param now Instante atual em ms.
 * @param elapsedSeconds Tempo desde o último tick. Até offlineThresholdSeconds.
 *
 * Casos de borda:
 * - Sem expedição em andamento: não faz nada.
 * - Expedição salva sem cena (a página foi recarregada no meio dela): entrega a
 *   bolsa como "interrompida".
 * - Os eventos só são entregues em intervalos de até maxSecondsWithEvents.
 */
export function runExpeditionTick(
  set: SetStore,
  get: GetStore,
  now: number,
  elapsedSeconds: number,
): void {
  const scene = get().expeditionScene;

  if (get().expedition === null) {
    return;
  }
  if (scene === null) {
    endExpedition(set, get, 'interrompida', now);
    return;
  }

  const current = pickGameState(get());
  const input = { ...get().moveInput, useSpecial: get().isSpecialPending };
  const fighter = getExpeditionFighter(current, now);
  const step = advanceScene(scene, fighter, input, elapsedSeconds, Math.random);
  const isTabActive = elapsedSeconds <= BALANCE.maxSecondsWithEvents;
  const hasEvents = isTabActive && step.events.length > 0;

  commitState(set, current, addKillsToLoot(current, step.kills), {
    expeditionScene: step.scene,
    sceneEvents: hasEvents ? step.events : NO_SCENE_EVENTS,
    isSpecialPending: false,
  });

  if (step.outcome !== null) {
    endExpedition(set, get, step.outcome, now);
  }
}

/**
 * Termina a expedição em andamento e entrega a bolsa na clareira.
 *
 * @param set Função de gravação da store.
 * @param get Função de leitura da store.
 * @param outcome Como terminou. Só "concluida" dá bônus.
 * @param timestamp Instante da entrega (dia, noite e lua dos Rastros).
 * @returns true se havia expedição para terminar.
 */
export function endExpedition(
  set: SetStore,
  get: GetStore,
  outcome: ExpeditionOutcome,
  timestamp: number,
): boolean {
  const current = pickGameState(get());

  if (current.expedition === null) {
    return false;
  }

  const seconds = get().expeditionScene?.elapsedSeconds ?? 0;
  const result = finishExpedition(current, outcome, seconds, {
    startTimestamp: timestamp,
    random: Math.random,
  });

  commitState(set, current, result.state, {
    expeditionScene: null,
    moveInput: NO_INPUT,
    isSpecialPending: false,
    sceneEvents: NO_SCENE_EVENTS,
    expeditionReport: result.report,
  });
  return true;
}
