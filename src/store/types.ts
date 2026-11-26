/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/types.ts
 * O que faz: tipagens da store: o que ela guarda além do estado do jogo, as
 * ações que expõe e o que algumas ações devolvem.
 *
 * Mapa:
 *   1. Resultados de ações
 *   2. Estado de sessão
 *   3. Ações
 *   4. Store completa
 */

import type {
  CombatEvent,
  ExpeditionReport,
  ExpeditionScene,
  GameState,
  OfflineReport,
  Rarity,
  SceneEvent,
} from '../domain/types';

// =============================================================================
// =============================================================================
// R E S U L T A D O S   D E   A Ç Õ E S

// Importação: deu certo, ou a mensagem do que deu errado
export type ImportResult = { ok: true } | { ok: false; error: string };

// Comprovante de uma gravação manual
export interface SaveReceipt {
  savedAt: number; // instante da gravação, em ms
  sizeInCharacters: number | null; // tamanho do que está no localStorage. Null se não há nada.
}


// =============================================================================
// =============================================================================
// E S T A D O   D E   S E S S Ã O

// Direção que a pessoa aperta na expedição. Cada eixo vai de -1 a 1.
export interface MoveInput {
  moveX: number;
  moveY: number;
}

// Campos que existem só enquanto o jogo está aberto. Não vão para o localStorage.
export interface SessionState {
  expeditionScene: ExpeditionScene | null; // o que está no mapa agora. Null: sem expedição.
  moveInput: MoveInput; // direção que a pessoa está apertando
  isSpecialPending: boolean; // golpe especial pedido, que sai no próximo tick
  sceneEvents: readonly SceneEvent[]; // golpes e derrotas do último tick, para o mapa animar
  expeditionReport: ExpeditionReport | null; // saque da última volta, até a pessoa fechar
  offlineReport: OfflineReport | null; // preenchido quando a pessoa volta de uma ausência
  combatEvents: readonly CombatEvent[]; // o que aconteceu no último tick, para a interface animar
  isOpenInAnotherTab: boolean; // outra aba assumiu o jogo: esta para de simular e de gravar
  tickCount: number; // quantos ticks rodaram desde que a página abriu. Prova que o laço anda.
  rebrotaCeremony: RebrotaCeremony | null; // edição que acabou de começar, para a cerimônia
}

// O que a cerimônia de uma Rebrota mostra
export interface RebrotaCeremony {
  edition: number; // número da edição nova
  roots: number; // Raízes ganhas nesta Rebrota
}

// O que os seletores leem: estado do jogo mais estado de sessão, sem as ações
export type GameSnapshot = GameState & SessionState;


// =============================================================================
// =============================================================================
// A Ç Õ E S

export interface GameActions {
  // Simulação
  tick: (now?: number) => void;
  dismissOfflineReport: () => void;
  yieldToAnotherTab: () => void;

  // Expedições. startExpedition e leaveExpedition devolvem true quando a ação foi aplicada.
  startExpedition: (mapId: string) => boolean;
  leaveExpedition: () => boolean;
  setMoveInput: (input: MoveInput) => void;
  triggerSpecial: () => void;
  dismissExpeditionReport: () => void;

  // Jogo. Devolvem true quando a ação foi aplicada.
  chooseStarter: (encantadoId: string) => boolean;
  togglePartyMember: (encantadoId: string) => boolean;
  buyUpgrade: (upgradeId: string) => boolean;
  sealPact: (encantadoId: string) => boolean;
  setAutoProgress: (enabled: boolean) => void;
  challengeBoss: () => boolean;
  goToStage: (stage: number) => boolean;

  // Amuletos. Devolvem true quando a ação foi aplicada.
  equipAmulet: (encantadoId: string, amuletId: string) => boolean;
  unequipAmulet: (encantadoId: string) => boolean;
  salvageAmulet: (amuletId: string) => boolean;
  salvageBagUpTo: (maxRarity: Rarity) => boolean;
  carveAmulet: (amuletId: string) => boolean;
  setAutoSalvage: (maxRarity: Rarity | null) => void;

  // Rebrota e juazeiro. Devolvem true quando a ação foi aplicada.
  rebrota: () => boolean;
  buyJuazeiroNode: (nodeId: string) => boolean;
  setAutoBuy: (enabled: boolean) => void;
  dismissRebrotaCeremony: () => void;

  // Salvamento
  saveNow: () => SaveReceipt;
  exportSave: () => string;
  importSave: (code: string) => ImportResult;
  hardReset: () => void;

  // Teste
  debugHitEnemy: (hpFraction: number) => void;
  debugGrantGold: (amount: number) => void;
  debugSkipTime: (seconds: number) => void;
  debugGrantAmulet: () => void;
  debugGrantRoots: (amount: number) => void;
}


// =============================================================================
// =============================================================================
// S T O R E   C O M P L E T A

export type GameStore = GameState & SessionState & GameActions;
