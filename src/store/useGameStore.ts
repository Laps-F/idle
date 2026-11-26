/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/useGameStore.ts
 * O que faz: é o estado global do jogo (Zustand). Guarda o GameState, expõe
 * as ações que a interface chama e grava tudo no localStorage.
 *
 * A store só coordena. Ela não tem regra de jogo: pega o estado atual, chama
 * uma função pura de src/domain, recebe o estado novo e grava. As regras
 * ficam em src/domain e os números em src/data.
 *
 * Imutabilidade: o estado nunca é alterado no lugar. Toda mudança cria
 * objetos novos e entra pelo "set" do Zustand.
 *
 * Como o tempo funciona: lastSaveTimestamp marca até onde o jogo já foi
 * simulado. Cada tick mede quanto tempo real passou desde então e simula
 * exatamente esse intervalo. Intervalo curto é jogo aberto. Intervalo longo
 * é ausência: rende com teto e eficiência reduzida e gera o relatório de
 * "bem-vindo de volta".
 *
 * Ordem de cada passo, como em qualquer laço de jogo: entrada, atualização,
 * desenho. Toda ação da pessoa primeiro simula o jogo até o instante do clique
 * e só depois é aplicada. Assim uma compra nunca vale para o tempo que já passou.
 *
 * Clareira e expedição: o combate por estágios (a clareira) roda em todo
 * tick, com o jogo aberto ou fechado. Quando há expedição em andamento, o
 * mesmo tick também anda com a cena do mapa (src/domain/expeditionScene.ts)
 * e guarda as derrotas na bolsa (src/domain/expedition.ts). A bolsa só vira
 * Patacas, XP e quedas na volta (finishExpedition). A expedição não roda com
 * o jogo fechado: uma ausência no meio dela entrega a bolsa como
 * "interrompida", e a clareira rende a ausência como sempre.
 *
 * É aqui, e não no domínio, que o relógio (Date.now) e o sorteio (Math.random)
 * são lidos. O domínio recebe os dois por parâmetro.
 *
 * Mapa:
 *   1. Constantes e tipos internos
 *   2. Store
 *   3. Ações de simulação (tick, progresso offline e troca de aba)
 *   4. Ações de expedição (partir, andar, golpe especial, voltar)
 *   5. Ações de jogo (comitiva, melhorias, pactos, estágios)
 *   6. Ações de amuletos (vestir, tirar, desmanchar, entalhar)
 *   7. Ações da Rebrota (rebrotar, juazeiro, compra automática)
 *   8. Ações de salvamento (gravar, exportar, importar, apagar tudo)
 *   9. Ações de teste (painel de debug e ajustes de teste)
 *  10. Ferramentas
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { BALANCE, MS_PER_SECOND } from '../data/balance';
import {
  buyUpgrade,
  challengeBoss,
  chooseStarter,
  goToStage,
  grantGold,
  setAutoProgress,
  togglePartyMember,
} from '../domain/actions';
import {
  carveAmulet,
  equipAmulet,
  generateAmulet,
  receiveAmulet,
  salvageAmulet,
  salvageBagUpTo,
  setAutoSalvage as setAmuletAutoSalvage,
  unequipAmulet,
} from '../domain/amulets';
import { buyJuazeiroNode } from '../domain/juazeiro';
import { applyOfflineProgress, hasOfflineGains, mergeOfflineReports } from '../domain/offline';
import { sealPact } from '../domain/pact';
import { performRebrota, setAutoBuy } from '../domain/rebrota';
import { advanceSimulation, dealDirectDamage } from '../domain/simulation';
import { createInitialState, pickGameState } from '../domain/state';
import type { CombatEvent, ExpeditionOutcome, GameState, SceneEvent } from '../domain/types';
import {
  addKillsToLoot,
  finishExpedition,
  getExpeditionFighter,
  startExpedition,
} from '../domain/expedition';
import { advanceScene, createExpeditionScene } from '../domain/expeditionScene';
import { preserveUnchangedReferences } from '../utils/object';
import {
  createThrottledStorage,
  decodeSave,
  encodeSave,
  getSavedGameSize,
  SAVE_STORAGE_KEY,
} from './saveManager';
import { loadSavedTuning, resetTuning as resetTuningValues, setTuningValue } from './tuning';
import type { GameActions, GameStore, MoveInput, SessionState } from './types';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S   I N T E R N O S

// Lista vazia única: reaproveitar a mesma referência evita redesenhar a interface à toa
const NO_EVENTS: readonly CombatEvent[] = [];
const NO_SCENE_EVENTS: readonly SceneEvent[] = [];
const NO_INPUT: MoveInput = { moveX: 0, moveY: 0 };

const SESSION_DEFAULTS: SessionState = {
  expeditionScene: null,
  moveInput: NO_INPUT,
  isSpecialPending: false,
  sceneEvents: NO_SCENE_EVENTS,
  expeditionReport: null,
  offlineReport: null,
  combatEvents: NO_EVENTS,
  isOpenInAnotherTab: false,
  tickCount: 0,
  rebrotaCeremony: null,
  tuningVersion: 0,
};

const OPEN_IN_ANOTHER_TAB_ERROR = 'O jogo está aberto em outra aba. Recarregue esta página.';

const saveStorage = createThrottledStorage(BALANCE.saveIntervalMs);

type SetStore = (partial: Partial<GameStore>) => void;
type GetStore = () => GameStore;

// Regra do domínio: recebe o estado e devolve o estado novo, ou null se a ação não vale
type Rule = (state: GameState) => GameState | null;

// Campos de sessão que uma entrada grava junto com o estado novo
type SessionUpdate = (previous: GameState, next: GameState) => Partial<SessionState>;


// =============================================================================
// =============================================================================
// S T O R E

// Os ajustes de teste guardados entram antes de a store montar o estado inicial
loadSavedTuning();

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(Date.now(), Math.random),
      ...SESSION_DEFAULTS,
      ...createSimulationActions(set, get),
      ...createExpeditionActions(set, get),
      ...createGameplayActions(set, get),
      ...createAmuletActions(set, get),
      ...createRebrotaActions(set, get),
      ...createSaveActions(set, get),
      ...createDebugActions(set, get),
    }),
    {
      name: SAVE_STORAGE_KEY,
      version: BALANCE.saveVersion,
      // A leitura já devolve o estado migrado e conferido (ver saveManager.ts)
      storage: saveStorage.storage,
      // Só o estado do jogo é gravado. Ações e campos de sessão ficam de fora.
      partialize: (store) => pickGameState(store),
    },
  ),
);


// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   S I M U L A Ç Ã O

type SimulationActions = Pick<GameActions, 'tick' | 'dismissOfflineReport' | 'yieldToAnotherTab'>;

// O tick e o que depende do tempo
function createSimulationActions(set: SetStore, get: GetStore): SimulationActions {
  return {
    /**
     * Avança o jogo do último instante simulado até "now".
     *
     * É o passo do laço do jogo. O intervalo entre dois ticks não é fixo: o
     * navegador atrasa abas em segundo plano. Por isso o tick mede o tempo real
     * que passou (delta-time) e simula exatamente esse intervalo.
     *
     * @param now Instante atual em milissegundos. Padrão: Date.now().
     *
     * Casos de borda:
     * - Intervalo de até 2 minutos (offlineThresholdSeconds): jogo aberto, rende 100%.
     *   Vale também para aba em segundo plano, que tica mais devagar.
     * - Intervalo maior: ausência. Rende com teto e eficiência reduzida e preenche
     *   "offlineReport". Se já havia um relatório aberto, os dois são somados.
     *   Ausência que não rendeu nada (sem comitiva, por exemplo) não gera relatório.
     * - "now" anterior ao último tick (relógio do aparelho voltou): nada rende e a
     *   marca de tempo é acertada para "now".
     * - "now" igual ao último tick: nada acontece e o tick não é contado.
     * - Jogo aberto em outra aba: nada acontece.
     * - Os eventos de combate só são entregues em intervalos de até 1 segundo.
     *   Acima disso a aba estava em segundo plano e não há o que animar.
     * - Com expedição em andamento, o jogo aberto também anda com a cena do mapa.
     *   Uma ausência no meio dela entrega a bolsa ("interrompida") antes de a
     *   clareira render a ausência.
     */
    tick: (now = Date.now()) => {
      const elapsedSeconds = (now - get().lastSaveTimestamp) / MS_PER_SECOND;

      if (get().isOpenInAnotherTab) {
        return;
      }
      if (elapsedSeconds < 0) {
        set({ lastSaveTimestamp: now, tickCount: get().tickCount + 1 });
      } else if (elapsedSeconds > BALANCE.offlineThresholdSeconds) {
        endExpedition(set, get, 'interrompida', get().lastSaveTimestamp);
        runOfflineTick(set, get, now);
      } else if (elapsedSeconds > 0) {
        runOnlineTick(set, get, now, elapsedSeconds);
        runExpeditionTick(set, get, now, elapsedSeconds);
      }
    },

    dismissOfflineReport: () => set({ offlineReport: null }),

    /**
     * Entrega o jogo para outra aba que acabou de abrir.
     *
     * Duas abas gravando no mesmo salvamento apagariam o progresso uma da outra.
     * Esta aba para de gravar e de simular, e a aba nova continua do último
     * salvamento. O intervalo que esta aba jogou sem gravar não se perde: a aba
     * nova simula esse tempo, porque o progresso é calculado pelo relógio.
     *
     * Caso de borda: não tem volta. Para jogar de novo nesta aba, é preciso recarregar.
     */
    yieldToAnotherTab: () => {
      saveStorage.disable();
      set({ isOpenInAnotherTab: true, combatEvents: NO_EVENTS, sceneEvents: NO_SCENE_EVENTS });
    },
  };
}

// Jogo aberto: simula o intervalo inteiro e entrega os eventos para a interface
function runOnlineTick(set: SetStore, get: GetStore, now: number, elapsedSeconds: number): void {
  const current = pickGameState(get());
  // Com a aba em segundo plano o intervalo cresce, e animar centenas de golpes de uma vez não ajuda
  const isTabActive = elapsedSeconds <= BALANCE.maxSecondsWithEvents;
  const result = advanceSimulation(current, elapsedSeconds, {
    startTimestamp: current.lastSaveTimestamp,
    random: Math.random,
    collectEvents: isTabActive,
  });
  const next: GameState = { ...result.state, lastSaveTimestamp: now };

  commitState(set, current, next, {
    combatEvents: result.events.length > 0 ? result.events : NO_EVENTS,
    tickCount: get().tickCount + 1,
  });
}

// Volta de uma ausência: simula com teto e eficiência reduzida e guarda o relatório
function runOfflineTick(set: SetStore, get: GetStore, now: number): void {
  const current = pickGameState(get());
  const result = applyOfflineProgress(current, now, Math.random);
  const tickCount = get().tickCount + 1;

  // Ausência sem ganho nenhum não abre o modal de volta
  if (result.report === null || !hasOfflineGains(result.report)) {
    commitState(set, current, result.state, { tickCount });
    return;
  }

  const offlineReport = mergeOfflineReports(get().offlineReport, result.report);
  commitState(set, current, result.state, { offlineReport, combatEvents: NO_EVENTS, tickCount });
}


// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   E X P E D I Ç Ã O

type ExpeditionActions = Pick<
  GameActions,
  | 'startExpedition'
  | 'leaveExpedition'
  | 'setMoveInput'
  | 'triggerSpecial'
  | 'dismissExpeditionReport'
>;

// Partir, andar, golpe especial e voltar. As regras estão em src/domain/expedition.ts.
function createExpeditionActions(set: SetStore, get: GetStore): ExpeditionActions {
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
function runExpeditionTick(
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
function endExpedition(
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


// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   J O G O

type GameplayActions = Pick<
  GameActions,
  | 'chooseStarter'
  | 'togglePartyMember'
  | 'buyUpgrade'
  | 'sealPact'
  | 'setAutoProgress'
  | 'challengeBoss'
  | 'goToStage'
>;

// Tudo que a pessoa decide. Cada ação só liga a entrada à regra do domínio.
function createGameplayActions(set: SetStore, get: GetStore): GameplayActions {
  return {
    chooseStarter: (encantadoId) =>
      applyInput(set, get, (state) => chooseStarter(state, encantadoId)),
    togglePartyMember: (encantadoId) =>
      applyInput(set, get, (state) => togglePartyMember(state, encantadoId)),
    buyUpgrade: (upgradeId) => applyInput(set, get, (state) => buyUpgrade(state, upgradeId)),
    sealPact: (encantadoId) =>
      applyInput(set, get, (state) => sealPact(state, encantadoId, Date.now())),
    setAutoProgress: (enabled) => {
      applyInput(set, get, (state) => setAutoProgress(state, enabled));
    },
    challengeBoss: () => applyInput(set, get, (state) => challengeBoss(state)),
    goToStage: (stage) => applyInput(set, get, (state) => goToStage(state, stage, Math.random)),
  };
}

/**
 * Aplica uma entrada da pessoa seguindo a ordem do laço: primeiro atualiza, depois aplica.
 *
 * Antes de aplicar a regra, roda um tick até o instante atual. Sem isso, uma
 * melhoria comprada agora valeria também para o tempo que passou desde o último tick.
 *
 * @param set Função de gravação da store.
 * @param get Função de leitura da store.
 * @param rule Regra do domínio. Recebe o estado atual e devolve o estado novo, ou null.
 * @param sessionUpdate Opcional. Campos de sessão gravados junto com o estado novo
 *                      (por exemplo, a cerimônia da Rebrota).
 * @returns true se a regra devolveu um estado novo e ele foi gravado.
 *
 * Casos de borda: com o jogo aberto em outra aba, nada é aplicado e o retorno é
 * false. Quando a regra devolve null (ação não permitida), o estado não muda.
 */
function applyInput(
  set: SetStore,
  get: GetStore,
  rule: Rule,
  sessionUpdate?: SessionUpdate,
): boolean {
  if (get().isOpenInAnotherTab) {
    return false;
  }

  get().tick(Date.now());
  const current = pickGameState(get());
  const next = rule(current);

  if (next === null) {
    return false;
  }

  commitState(set, current, next, sessionUpdate?.(current, next));
  return true;
}


// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   A M U L E T O S

type AmuletActions = Pick<
  GameActions,
  | 'equipAmulet'
  | 'unequipAmulet'
  | 'salvageAmulet'
  | 'salvageBagUpTo'
  | 'carveAmulet'
  | 'setAutoSalvage'
>;

// O que a pessoa faz com os amuletos. As regras estão em src/domain/amulets.ts.
// A queda de amuletos não passa por aqui: ela acontece dentro da simulação, a cada
// inimigo derrotado, e chega pelo tick como qualquer outra recompensa.
function createAmuletActions(set: SetStore, get: GetStore): AmuletActions {
  return {
    equipAmulet: (encantadoId, amuletId) =>
      applyInput(set, get, (state) => equipAmulet(state, encantadoId, amuletId)),
    unequipAmulet: (encantadoId) =>
      applyInput(set, get, (state) => unequipAmulet(state, encantadoId)),
    salvageAmulet: (amuletId) => applyInput(set, get, (state) => salvageAmulet(state, amuletId)),
    salvageBagUpTo: (maxRarity) =>
      applyInput(set, get, (state) => salvageBagUpTo(state, maxRarity)),
    carveAmulet: (amuletId) => applyInput(set, get, (state) => carveAmulet(state, amuletId)),
    setAutoSalvage: (maxRarity) => {
      applyInput(set, get, (state) => setAmuletAutoSalvage(state, maxRarity));
    },
  };
}


// =============================================================================
// =============================================================================
// A Ç Õ E S   D A   R E B R O T A

type RebrotaActions = Pick<
  GameActions,
  'rebrota' | 'buyJuazeiroNode' | 'setAutoBuy' | 'dismissRebrotaCeremony'
>;

// Rebrota e juazeiro. As regras estão em src/domain/rebrota.ts e src/domain/juazeiro.ts.
function createRebrotaActions(set: SetStore, get: GetStore): RebrotaActions {
  return {
    /**
     * Começa uma nova edição do folheto (src/domain/rebrota.ts, performRebrota).
     *
     * Além do estado novo, grava a cerimônia (para a janela da edição nova) e um
     * evento "rebrota" (para a linha do registro).
     *
     * @returns true se a Rebrota aconteceu. False se ainda não estava liberada.
     */
    rebrota: () =>
      applyInput(
        set,
        get,
        (state) => performRebrota(state, Math.random),
        (previous, next) => describeRebrota(previous, next),
      ),
    buyJuazeiroNode: (nodeId) => applyInput(set, get, (state) => buyJuazeiroNode(state, nodeId)),
    setAutoBuy: (enabled) => {
      applyInput(set, get, (state) => setAutoBuy(state, enabled));
    },
    dismissRebrotaCeremony: () => set({ rebrotaCeremony: null }),
  };
}

// Cerimônia e evento de registro de uma Rebrota que acabou de acontecer
function describeRebrota(previous: GameState, next: GameState): Partial<SessionState> {
  const ceremony = { edition: next.edition, roots: next.roots - previous.roots };
  const event: CombatEvent = { type: 'rebrota', ...ceremony };
  return { rebrotaCeremony: ceremony, combatEvents: [event] };
}


// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   S A L V A M E N T O

type SaveActions = Pick<GameActions, 'saveNow' | 'exportSave' | 'importSave' | 'hardReset'>;

// Gravar agora, exportar, importar e apagar tudo
function createSaveActions(set: SetStore, get: GetStore): SaveActions {
  return {
    // Grava no localStorage sem esperar o intervalo e devolve o comprovante
    saveNow: () => {
      saveStorage.flush();
      return { savedAt: Date.now(), sizeInCharacters: getSavedGameSize() };
    },

    // Código para copiar e guardar fora do navegador
    exportSave: () => encodeSave(pickGameState(get()), Date.now()),

    /**
     * Troca o jogo atual pelo jogo de um código de exportação.
     *
     * @param code Código gerado por "exportSave".
     * @returns { ok: true } se importou, ou { ok: false, error } com a mensagem para a pessoa.
     *
     * Casos de borda: código inválido, de outro jogo ou de versão mais nova não muda
     * nada. Importar não rende progresso offline. O relatório de ausência aberto é
     * fechado. O jogo importado é gravado na hora. Com o jogo aberto em outra aba,
     * a importação é recusada.
     */
    importSave: (code) => {
      if (get().isOpenInAnotherTab) {
        return { ok: false, error: OPEN_IN_ANOTHER_TAB_ERROR };
      }

      const decoded = decodeSave(code, Date.now(), Math.random);

      if (!decoded.ok) {
        return decoded;
      }

      replaceGame(set, decoded.state);
      return { ok: true };
    },

    /**
     * Apaga o jogo inteiro e começa de novo.
     *
     * Não pede confirmação: isso é papel da interface, que só chama esta ação
     * depois de a pessoa confirmar.
     *
     * Casos de borda: o jogo novo é gravado na hora, por cima do antigo, e não há
     * como desfazer. Com o jogo aberto em outra aba, nada é apagado.
     */
    hardReset: () => {
      if (!get().isOpenInAnotherTab) {
        replaceGame(set, createInitialState(Date.now(), Math.random));
      }
    },
  };
}

// Substitui o jogo inteiro e grava na hora, para o salvamento antigo não voltar
function replaceGame(set: SetStore, state: GameState): void {
  set({
    ...state,
    offlineReport: null,
    combatEvents: NO_EVENTS,
    rebrotaCeremony: null,
    expeditionScene: null,
    sceneEvents: NO_SCENE_EVENTS,
    expeditionReport: null,
  });
  saveStorage.flush();
}


// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   T E S T E

type DebugActions = Pick<
  GameActions,
  | 'debugHitEnemy'
  | 'debugGrantGold'
  | 'debugSkipTime'
  | 'debugGrantAmulet'
  | 'debugGrantRoots'
  | 'debugSetLeaderLevel'
  | 'setTuning'
  | 'resetTuning'
>;

// Atalhos para o painel de debug mexer no jogo sem esperar o ritmo normal.
// Passam pelo mesmo caminho das ações de jogo: simulam até agora e só então aplicam.
function createDebugActions(set: SetStore, get: GetStore): DebugActions {
  return {
    // Tira do inimigo uma fração da vida máxima (1 = derrota na hora)
    debugHitEnemy: (hpFraction) => {
      applyInput(set, get, (state) => hitEnemy(state, hpFraction));
    },

    // Soma Patacas direto no saldo
    debugGrantGold: (amount) => {
      applyInput(set, get, (state) => grantGold(state, amount));
    },

    // Faz de conta que o jogo ficou fechado por "seconds" segundos: recua a marca do tempo
    // e roda um tick. Acima do limite de ausência, cai no caminho offline e gera o relatório.
    debugSkipTime: (seconds) => {
      const canSkip = seconds > 0 && !get().isOpenInAnotherTab;

      if (canSkip) {
        get().tick(Date.now());
        set({ lastSaveTimestamp: get().lastSaveTimestamp - seconds * MS_PER_SECOND });
        get().tick(Date.now());
      }
    },

    // Faz cair um amuleto do estágio atual, com raridade e bônus sorteados como em uma queda
    debugGrantAmulet: () => {
      applyInput(set, get, (state) => grantAmulet(state));
    },

    // Finca Raízes direto, sem rebrotar, para testar o juazeiro
    debugGrantRoots: (amount) => {
      applyInput(set, get, (state) => grantRoots(state, amount));
    },

    // Põe o primeiro da comitiva no nível pedido, com o XP zerado
    debugSetLeaderLevel: (level) =>
      applyInput(set, get, (state) => setLeaderLevel(state, level)),

    /**
     * Troca um número de balanceamento na hora (ajustes de teste).
     *
     * @param fieldId Campo do painel "Ajustes" (src/store/tuning.ts).
     * @param value Valor novo.
     * @returns true se o valor foi aceito. O painel redesenha pelo tuningVersion.
     */
    setTuning: (fieldId, value) => {
      const isAccepted = setTuningValue(fieldId, value);
      set({ tuningVersion: get().tuningVersion + 1 });
      return isAccepted;
    },

    // Volta um campo (ou todos, com null) ao valor do código
    resetTuning: (fieldId) => {
      resetTuningValues(fieldId);
      set({ tuningVersion: get().tuningVersion + 1 });
    },
  };
}

// Nível do primeiro da comitiva. Null sem comitiva ou com nível abaixo de 1.
function setLeaderLevel(state: GameState, level: number): GameState | null {
  const leaderId = state.party[0];
  const owned = leaderId === undefined ? undefined : state.roster[leaderId];
  const wholeLevel = Math.floor(level);

  if (leaderId === undefined || owned === undefined || !(wholeLevel >= 1)) {
    return null;
  }

  const leader = { ...owned, level: wholeLevel, xp: 0 };
  return { ...state, roster: { ...state.roster, [leaderId]: leader } };
}

// Gera um amuleto e entrega pelo mesmo caminho de uma queda (mochila ou desmanche)
function grantAmulet(state: GameState): GameState {
  const amulet = generateAmulet(state.nextAmuletNumber, state.stage, Math.random);
  return receiveAmulet(state, amulet).state;
}

// Soma Raízes fincadas. Null para quantidade zero ou negativa.
function grantRoots(state: GameState, amount: number): GameState | null {
  return amount > 0 ? { ...state, roots: state.roots + amount } : null;
}

// Golpe direto de uma fração da vida máxima. Null quando o golpe não tira nada.
function hitEnemy(state: GameState, hpFraction: number): GameState | null {
  const damage = state.combat.enemyMaxHp * hpFraction;
  const result = dealDirectDamage(state, damage, {
    startTimestamp: state.lastSaveTimestamp,
    random: Math.random,
  });

  return result.state === state ? null : result.state;
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S

// Grava o estado novo na store, em uma gravação só, junto com os campos de sessão.
// Campo que não mudou de conteúdo mantém a referência antiga, para a interface
// redesenhar só o que mudou de verdade.
function commitState(
  set: SetStore,
  previous: GameState,
  next: GameState,
  session: Partial<SessionState> = {},
): void {
  set({ ...preserveUnchangedReferences(previous, next), ...session });
}
