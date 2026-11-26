/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/storeTools.ts
 * O que faz: as peças que todos os grupos de ações da store usam: os tipos de
 * leitura e gravação, as listas vazias únicas, a gravação do estado novo e a
 * aplicação de uma entrada da pessoa.
 *
 * Quem usa: src/store/useGameStore.ts e src/store/expeditionSession.ts.
 *
 * Mapa:
 *   1. Tipos
 *   2. Valores vazios únicos
 *   3. Gravação e entrada
 */

import { pickGameState } from '../domain/state';
import type { CombatEvent, GameState, SceneEvent } from '../domain/types';
import { preserveUnchangedReferences } from '../utils/object';
import type { GameStore, MoveInput, SessionState } from './types';

// =============================================================================
// =============================================================================
// T I P O S

export type SetStore = (partial: Partial<GameStore>) => void;
export type GetStore = () => GameStore;

// Regra do domínio: recebe o estado e devolve o estado novo, ou null se a ação não vale
export type Rule = (state: GameState) => GameState | null;

// Campos de sessão que uma entrada grava junto com o estado novo
export type SessionUpdate = (previous: GameState, next: GameState) => Partial<SessionState>;


// =============================================================================
// =============================================================================
// V A L O R E S   V A Z I O S   Ú N I C O S

// Reaproveitar a mesma referência evita redesenhar a interface à toa
export const NO_EVENTS: readonly CombatEvent[] = [];
export const NO_SCENE_EVENTS: readonly SceneEvent[] = [];
export const NO_INPUT: MoveInput = { moveX: 0, moveY: 0 };


// =============================================================================
// =============================================================================
// G R A V A Ç Ã O   E   E N T R A D A

// Grava o estado novo na store, em uma gravação só, junto com os campos de sessão.
// Campo que não mudou de conteúdo mantém a referência antiga, para a interface
// redesenhar só o que mudou de verdade.
export function commitState(
  set: SetStore,
  previous: GameState,
  next: GameState,
  session: Partial<SessionState> = {},
): void {
  set({ ...preserveUnchangedReferences(previous, next), ...session });
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
export function applyInput(
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
