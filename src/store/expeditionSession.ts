/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/expeditionSession.ts
 * O que faz: a parte da store que cuida da expedição: as ações de partir,
 * andar, golpe especial, pausar e voltar, o passo do mapa dentro do tick, o que
 * fazer com a expedição numa ausência e a entrega da bolsa na volta. As regras
 * ficam em src/domain/expedition.ts e src/domain/expeditionScene.ts. Aqui só se
 * liga a entrada à regra e se grava.
 *
 * Quem usa: src/store/useGameStore.ts, que junta estas ações às outras e chama
 * runExpeditionTick e holdExpeditionDuringAbsence dentro do tick.
 *
 * Pausa: com isExpeditionPaused, a cena não anda (tempo, ondas, recargas e
 * visagens param). É só estado de sessão: não vai para o salvamento.
 *
 * Mapa:
 *   1. Ações de expedição
 *   2. Passo do mapa e volta para a clareira
 */

import { BALANCE } from '../data/balance';
import {
  addKillsToLoot,
  addTrailsToLoot,
  finishExpedition,
  getExpeditionFighter,
  getSceneSetup,
  startExpedition,
} from '../domain/expedition';
import { advanceScene, createExpeditionScene } from '../domain/expeditionScene';
import { pickGameState } from '../domain/state';
import type { ExpeditionOutcome, ExpeditionScene, GameState } from '../domain/types';
import { applyInput, commitState, NO_INPUT, NO_SCENE_EVENTS } from './storeTools';
import type { GetStore, SetStore } from './storeTools';
import type { GameActions, SessionState } from './types';

// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   E X P E D I Ç Ã O

// Campos gravados ao pausar: a personagem para e o golpe pedido é esquecido
const PAUSED_SESSION: Partial<SessionState> = {
  isExpeditionPaused: true,
  moveInput: NO_INPUT,
  isSpecialPending: false,
};

export type ExpeditionActions = Pick<
  GameActions,
  | 'startExpedition'
  | 'leaveExpedition'
  | 'setMoveInput'
  | 'triggerSpecial'
  | 'pauseExpedition'
  | 'resumeExpedition'
  | 'dismissExpeditionReport'
>;

// Partir, andar, golpe especial, pausar e voltar. As regras estão em src/domain/expedition.ts.
export function createExpeditionActions(set: SetStore, get: GetStore): ExpeditionActions {
  return {
    /**
     * Parte em expedição com o primeiro encantado da comitiva e monta a cena do mapa.
     *
     * @param mapId Mapa da expedição (src/data/world.ts).
     * @param preparationId Opcional. Preparo pago com Oferendas ao partir
     *                      (src/data/expeditionPreparations.ts). Ausente ou null: nenhum.
     * @returns true se partiu. False sem comitiva, já em expedição, com mapa que não existe,
     *          ou com preparo que não existe ou sem Oferendas bastantes.
     */
    startExpedition: (mapId, preparationId = null) =>
      applyInput(
        set,
        get,
        (state) => startExpedition(state, mapId, preparationId),
        (_previous, next) => ({
          expeditionScene: createSceneFor(next),
          moveInput: NO_INPUT,
          isSpecialPending: false,
          isExpeditionPaused: false,
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
    // Com a expedição pausada, a direção fica parada: quem volta começa sem andar.
    setMoveInput: (input) => {
      const current = get().moveInput;
      const hasChanged = current.moveX !== input.moveX || current.moveY !== input.moveY;

      if (hasChanged && !get().isExpeditionPaused) {
        set({ moveInput: { moveX: input.moveX, moveY: input.moveY } });
      }
    },

    // Pede o golpe especial. Ele sai no próximo tick, se estiver pronto. Pausada, não pede.
    triggerSpecial: () => {
      if (get().expedition !== null && !get().isExpeditionPaused) {
        set({ isSpecialPending: true });
      }
    },

    /**
     * Pausa a cena do mapa: tempo, ondas, recargas, visagens e projéteis param.
     *
     * Chamada ao esconder a aba, ao trocar de janela (src/store/gameLoop.ts) e pela
     * tecla P. A clareira continua rendendo. Antes de pausar, o jogo é simulado
     * até agora, para a pausa valer a partir deste instante.
     *
     * Casos de borda: sem expedição, sem cena, já pausada ou com o jogo aberto em
     * outra aba, não faz nada.
     */
    pauseExpedition: () => {
      if (!canPause(get)) {
        return;
      }

      get().tick(Date.now());

      // O tick pode ter acabado com a expedição (fim do tempo bem nesse passo)
      if (canPause(get)) {
        set(PAUSED_SESSION);
      }
    },

    /**
     * Continua a expedição pausada. A cena volta a andar no próximo tick.
     *
     * Antes de continuar, o jogo é simulado até agora (só a clareira anda, porque a
     * cena está pausada). Assim o próximo passo da cena mede só o tempo depois da volta.
     *
     * Casos de borda: sem expedição pausada ou com o jogo aberto em outra aba, não faz nada.
     */
    resumeExpedition: () => {
      if (get().isOpenInAnotherTab || !get().isExpeditionPaused) {
        return;
      }

      get().tick(Date.now());
      set({ isExpeditionPaused: false });
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
 * Anda com a cena pelo tempo que passou, guarda as derrotas e os Rastros das
 * pegadas pegas na bolsa e, se a
 * expedição acabou (fim do tempo, vida zerada ou passagem de volta), entrega a bolsa.
 *
 * @param set Função de gravação da store.
 * @param get Função de leitura da store.
 * @param now Instante atual em ms.
 * @param elapsedSeconds Tempo desde o último tick. Até offlineThresholdSeconds.
 *
 * Casos de borda:
 * - Sem expedição em andamento: não faz nada.
 * - Expedição pausada: a cena não anda. O tempo pausado não conta para nada.
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
  if (get().isExpeditionPaused) {
    // Pausada, nada anda: nem a cena, nem a clareira. Só a marca de tempo segue.
    set({ lastSaveTimestamp: now, tickCount: get().tickCount + 1 });
    return;
  }

  const current = pickGameState(get());
  const input = { ...get().moveInput, useSpecial: get().isSpecialPending };
  const fighter = getExpeditionFighter(current, now);
  const step = advanceScene(scene, fighter, input, elapsedSeconds, Math.random);
  const isTabActive = elapsedSeconds <= BALANCE.maxSecondsWithEvents;
  const hasEvents = isTabActive && step.events.length > 0;

  const withLoot = addTrailsToLoot(addKillsToLoot(current, step.kills), step.trails);
  const next = withActiveSeconds(withLoot, step.scene.elapsedSeconds, now);

  commitState(set, current, next, {
    tickCount: get().tickCount + 1,
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

  // Sem cena (recarga no meio), vale o tempo salvo na própria expedição
  const seconds = get().expeditionScene?.elapsedSeconds ?? current.expedition.activeSeconds;
  const result = finishExpedition(current, outcome, seconds, {
    startTimestamp: timestamp,
    random: Math.random,
  });

  commitState(set, current, result.state, {
    expeditionScene: null,
    moveInput: NO_INPUT,
    isSpecialPending: false,
    isExpeditionPaused: false,
    sceneEvents: NO_SCENE_EVENTS,
    expeditionReport: result.report,
  });
  return true;
}

/**
 * O que acontece com a expedição quando o tick encontra uma ausência (mais de
 * offlineThresholdSeconds desde o último tick).
 *
 * Com a cena ainda na memória (aba escondida por muito tempo, computador
 * dormindo), a expedição fica pausada esperando a pessoa, e a ausência não rende
 * (a clareira só rende com a comitiva na clareira). Sem cena (a página foi
 * recarregada ou o jogo foi fechado), a bolsa é entregue como "interrompida", no
 * instante do último tick, e quem chamou deixa a clareira render a ausência.
 *
 * @param set Função de gravação da store.
 * @param get Função de leitura da store.
 * @param now Instante atual em ms, para a marca de tempo da ausência que não rende.
 *
 * Caso de borda: sem expedição em andamento, não faz nada.
 */
export function holdExpeditionDuringAbsence(set: SetStore, get: GetStore, now: number): void {
  if (get().expedition === null) {
    return;
  }

  if (get().expeditionScene === null) {
    endExpedition(set, get, 'interrompida', get().lastSaveTimestamp);
  } else {
    // A comitiva está fora: a ausência não rende na clareira, só passa
    set({ ...PAUSED_SESSION, lastSaveTimestamp: now, tickCount: get().tickCount + 1 });
  }
}

// Guarda na expedição o tempo andado (para a garantia numa recarga) e a marca de tempo
function withActiveSeconds(state: GameState, activeSeconds: number, now: number): GameState {
  const { expedition } = state;
  const updated = expedition === null ? null : { ...expedition, activeSeconds };
  return { ...state, expedition: updated, lastSaveTimestamp: now };
}

// Cena do começo da expedição que acabou de partir. Null não acontece depois de startExpedition.
function createSceneFor(state: GameState): ExpeditionScene | null {
  const setup = getSceneSetup(state, Date.now());
  return setup === null ? null : createExpeditionScene(setup, Math.random);
}

// Dá para pausar: há expedição com cena, ainda não pausada, e esta aba cuida do jogo
function canPause(get: GetStore): boolean {
  const store = get();
  return (
    !store.isOpenInAnotherTab &&
    store.expedition !== null &&
    store.expeditionScene !== null &&
    !store.isExpeditionPaused
  );
}
