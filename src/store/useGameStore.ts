/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/useGameStore.ts
 * O que faz: é o estado global do jogo (Zustand). Guarda o GameState, expõe
 * as ações que a interface chama e grava tudo no localStorage.
 *
 * Como o tempo funciona: lastSaveTimestamp marca até onde o jogo já foi
 * simulado. Cada tick mede quanto tempo real passou desde então e simula
 * exatamente esse intervalo. Intervalo curto é jogo aberto. Intervalo longo
 * é ausência: rende com teto e eficiência reduzida e gera o relatório de
 * "bem-vindo de volta".
 *
 * A store só coordena. As regras ficam em src/engine e os números em src/data.
 *
 * Mapa:
 *   1. Tipos
 *   2. Constantes
 *   3. Store
 *   4. Ações de simulação (tick e progresso offline)
 *   5. Ações de jogo (comitiva, melhorias, pactos, estágios)
 *   6. Ações de salvamento (exportar, importar, apagar tudo)
 *   7. Ferramentas
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { BALANCE, MS_PER_SECOND } from '../data/balance';
import { getEncantado, getUpgrade, getZoneForStage, hasEncantado, hasUpgrade } from '../data';
import { getUpgradeCost, isUpgradeMaxed } from '../engine/formulas';
import { applyOfflineProgress, mergeOfflineReports } from '../engine/offline';
import { sealPact } from '../engine/pact';
import { advanceSimulation } from '../engine/simulation';
import {
  cloneGameState,
  createInitialState,
  pickGameState,
  spawnBoss,
  spawnCommonEnemy,
} from '../engine/state';
import type { CombatEvent, GameState, OfflineReport } from '../types/game';
import { preserveUnchangedReferences } from '../utils/object';
import {
  createThrottledStorage,
  decodeSave,
  encodeSave,
  migrateSave,
  sanitizeGameState,
  SAVE_STORAGE_KEY,
} from './saveManager';

// =============================================================================
// =============================================================================
// T I P O S

export type ImportResult = { ok: true } | { ok: false; error: string };

export interface GameActions {
  // Simulação
  tick: (now?: number) => void;
  dismissOfflineReport: () => void;

  // Jogo
  chooseStarter: (encantadoId: string) => boolean;
  togglePartyMember: (encantadoId: string) => boolean;
  buyUpgrade: (upgradeId: string) => boolean;
  sealPact: (encantadoId: string) => boolean;
  setAutoProgress: (enabled: boolean) => void;
  challengeBoss: () => boolean;
  goToStage: (stage: number) => boolean;

  // Salvamento
  saveNow: () => void;
  exportSave: () => string;
  importSave: (code: string) => ImportResult;
  hardReset: () => void;
}

// Campos que existem só enquanto o jogo está aberto. Não vão para o localStorage.
export interface SessionState {
  offlineReport: OfflineReport | null; // preenchido quando a pessoa volta de uma ausência
  combatEvents: readonly CombatEvent[]; // o que aconteceu no último tick, para a interface animar
}

export type GameStore = GameState & SessionState & GameActions;

type SetStore = (partial: Partial<GameStore>) => void;
type GetStore = () => GameStore;


// =============================================================================
// =============================================================================
// C O N S T A N T E S

// Lista vazia única: reaproveitar a mesma referência evita redesenhar a interface à toa
const NO_EVENTS: readonly CombatEvent[] = [];

const SESSION_DEFAULTS: SessionState = { offlineReport: null, combatEvents: NO_EVENTS };

const saveStorage = createThrottledStorage(BALANCE.saveIntervalMs);


// =============================================================================
// =============================================================================
// S T O R E

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(Date.now()),
      ...SESSION_DEFAULTS,
      ...createSimulationActions(set, get),
      ...createGameplayActions(set, get),
      ...createSaveActions(set, get),
    }),
    {
      name: SAVE_STORAGE_KEY,
      version: BALANCE.saveVersion,
      storage: saveStorage.storage,
      partialize: (store) => pickGameState(store),
      migrate: (saved, version) => migrateSave(saved, version) as GameState,
      merge: (saved, current) => ({ ...current, ...sanitizeGameState(saved, Date.now()) }),
    },
  ),
);


// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   S I M U L A Ç Ã O

type SimulationActions = Pick<GameActions, 'tick' | 'dismissOfflineReport'>;

// O tick e o que depende do tempo
function createSimulationActions(set: SetStore, get: GetStore): SimulationActions {
  return {
    // Avança o jogo do último instante simulado até "now"
    tick: (now = Date.now()) => {
      const elapsedSeconds = (now - get().lastSaveTimestamp) / MS_PER_SECOND;

      if (elapsedSeconds < 0) {
        // O relógio do aparelho voltou no tempo: só acerta a marca, sem render nada
        set({ lastSaveTimestamp: now });
      } else if (elapsedSeconds > BALANCE.offlineThresholdSeconds) {
        runOfflineTick(set, get, now);
      } else if (elapsedSeconds > 0) {
        runOnlineTick(set, get, now, elapsedSeconds);
      }
    },

    dismissOfflineReport: () => set({ offlineReport: null }),
  };
}

// Jogo aberto: simula o intervalo inteiro e entrega os eventos para a interface
function runOnlineTick(set: SetStore, get: GetStore, now: number, elapsedSeconds: number): void {
  const events: CombatEvent[] = [];
  // Com a aba em segundo plano o intervalo cresce, e animar centenas de golpes de uma vez não ajuda
  const isTabActive = elapsedSeconds <= BALANCE.maxSecondsWithEvents;
  const onEvent = isTabActive ? (event: CombatEvent) => events.push(event) : undefined;

  const simulate = (draft: GameState): void => {
    advanceSimulation(draft, elapsedSeconds, { startTimestamp: draft.lastSaveTimestamp, onEvent });
    draft.lastSaveTimestamp = now;
  };
  const describeSession = (): Partial<SessionState> => ({
    combatEvents: events.length > 0 ? events : NO_EVENTS,
  });

  commitChange(set, get, simulate, describeSession);
}

// Volta de uma ausência: simula com teto e eficiência reduzida e guarda o relatório
function runOfflineTick(set: SetStore, get: GetStore, now: number): void {
  const simulate = (draft: GameState): OfflineReport | null => applyOfflineProgress(draft, now);
  const describeSession = (report: OfflineReport | null): Partial<SessionState> => {
    if (report === null) {
      return {};
    }
    const offlineReport = mergeOfflineReports(get().offlineReport, report);
    return { offlineReport, combatEvents: NO_EVENTS };
  };

  commitChange(set, get, simulate, describeSession);
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

// Tudo que a pessoa decide: comitiva, melhorias, pactos e estágios.
// As ações que podem falhar devolvem true quando deram certo.
function createGameplayActions(set: SetStore, get: GetStore): GameplayActions {
  return {
    chooseStarter: (encantadoId) =>
      commitChange(set, get, (draft) => chooseStarter(draft, encantadoId)),
    togglePartyMember: (encantadoId) =>
      commitChange(set, get, (draft) => togglePartyMember(draft, encantadoId)),
    buyUpgrade: (upgradeId) =>
      commitChange(set, get, (draft) => buyUpgrade(draft, upgradeId)),
    sealPact: (encantadoId) =>
      commitChange(set, get, (draft) => sealPact(draft, encantadoId, Date.now())),
    setAutoProgress: (enabled) => set({ autoProgress: enabled }),
    challengeBoss: () => commitChange(set, get, (draft) => challengeBoss(draft)),
    goToStage: (stage) => commitChange(set, get, (draft) => goToStage(draft, stage)),
  };
}

// Primeiro encantado da comitiva. Só vale uma vez, com o elenco vazio.
function chooseStarter(draft: GameState, encantadoId: string): boolean {
  const hasNoRoster = Object.keys(draft.roster).length === 0;
  const isStarter = hasEncantado(encantadoId) && getEncantado(encantadoId).isStarter;

  if (!hasNoRoster || !isStarter) {
    return false;
  }

  draft.roster[encantadoId] = { id: encantadoId, level: 1, xp: 0, bond: 0 };
  draft.party = [encantadoId];
  draft.combat.attackProgress = { [encantadoId]: 0 };
  return true;
}

// Tira da comitiva quem está nela, ou coloca quem está fora
function togglePartyMember(draft: GameState, encantadoId: string): boolean {
  return draft.party.includes(encantadoId)
    ? removeFromParty(draft, encantadoId)
    : addToParty(draft, encantadoId);
}

// Sai da comitiva, desde que não seja o último
function removeFromParty(draft: GameState, encantadoId: string): boolean {
  const isLastMember = draft.party.length <= 1;

  if (isLastMember) {
    return false;
  }

  draft.party = draft.party.filter((memberId) => memberId !== encantadoId);
  delete draft.combat.attackProgress[encantadoId];
  return true;
}

// Entra na comitiva, desde que esteja no elenco e haja vaga
function addToParty(draft: GameState, encantadoId: string): boolean {
  const isOwned = encantadoId in draft.roster;
  const hasRoom = draft.party.length < BALANCE.maxPartySize;

  if (!isOwned || !hasRoom) {
    return false;
  }

  draft.party.push(encantadoId);
  draft.combat.attackProgress[encantadoId] = 0;
  return true;
}

// Compra um nível da melhoria, se houver Patacas e o nível máximo não tiver chegado
function buyUpgrade(draft: GameState, upgradeId: string): boolean {
  if (!hasUpgrade(upgradeId)) {
    return false;
  }

  const upgrade = getUpgrade(upgradeId);
  const level = draft.upgrades[upgradeId] ?? 0;
  const cost = getUpgradeCost(upgrade, level);
  const canBuy = draft.gold >= cost && !isUpgradeMaxed(upgrade, level);

  if (!canBuy) {
    return false;
  }

  draft.gold -= cost;
  draft.upgrades[upgradeId] = level + 1;
  return true;
}

// Chama o chefe na hora, para quem joga com o avanço automático desligado
function challengeBoss(draft: GameState): boolean {
  const zone = getZoneForStage(draft.stage);
  const canChallenge = !draft.combat.isBoss && draft.killsInStage >= zone.killsToBoss;

  if (!canChallenge) {
    return false;
  }

  spawnBoss(draft);
  return true;
}

// Muda para um estágio já liberado, para voltar e juntar Oferendas
function goToStage(draft: GameState, stage: number): boolean {
  const isUnlocked = Number.isInteger(stage) && stage >= 1 && stage <= draft.maxStage;

  if (!isUnlocked) {
    return false;
  }

  draft.stage = stage;
  draft.killsInStage = 0;
  spawnCommonEnemy(draft, Math.random);
  return true;
}


// =============================================================================
// =============================================================================
// A Ç Õ E S   D E   S A L V A M E N T O

type SaveActions = Pick<GameActions, 'saveNow' | 'exportSave' | 'importSave' | 'hardReset'>;

// Gravar agora, exportar, importar e apagar tudo
function createSaveActions(set: SetStore, get: GetStore): SaveActions {
  return {
    // Grava no localStorage sem esperar o intervalo. O laço do jogo chama ao fechar a aba.
    saveNow: () => saveStorage.flush(),

    // Código para copiar e guardar fora do navegador
    exportSave: () => encodeSave(pickGameState(get()), Date.now()),

    // Troca o jogo atual pelo do código. Se o código for inválido, nada muda.
    importSave: (code) => {
      const decoded = decodeSave(code, Date.now());

      if (!decoded.ok) {
        return decoded;
      }

      replaceGame(set, decoded.state);
      return { ok: true };
    },

    // Apaga tudo e começa de novo. A confirmação dupla fica por conta da interface.
    hardReset: () => replaceGame(set, createInitialState(Date.now())),
  };
}

// Substitui o jogo inteiro e grava na hora, para o salvamento antigo não voltar
function replaceGame(set: SetStore, state: GameState): void {
  set({ ...state, ...SESSION_DEFAULTS });
  saveStorage.flush();
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S

// Aplica uma mudança numa cópia do estado e grava o resultado na store, numa gravação só.
// O motor altera a cópia à vontade e o estado antigo nunca é tocado.
// "describeSession" permite mudar junto os campos que não são salvos (relatório, eventos).
function commitChange<Result>(
  set: SetStore,
  get: GetStore,
  change: (draft: GameState) => Result,
  describeSession: (result: Result) => Partial<SessionState> = keepSession,
): Result {
  const previous = pickGameState(get());
  const draft = cloneGameState(previous);
  const result = change(draft);

  set({ ...preserveUnchangedReferences(previous, draft), ...describeSession(result) });
  return result;
}

// Padrão do commitChange: os campos de sessão ficam como estão
function keepSession(): Partial<SessionState> {
  return {};
}
