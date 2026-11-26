/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/App.tsx
 * O que faz: liga o laço do jogo e escolhe a tela.
 *
 *   - Normal: a clareira (combate por estágios, melhorias, comitiva, amuletos).
 *     Com uma expedição em andamento, a tela da expedição fica no lugar dela.
 *   - "?debug" (por exemplo, http://localhost:5173/?debug): o painel de debug,
 *     que mostra os números crus da clareira.
 *
 * O laço é o mesmo nas duas: a clareira rende sempre, e a expedição anda por
 * cima quando existe (src/store/useGameStore.ts, ação "tick").
 */

import { useEffect } from 'react';

import DebugView from './components/DebugView';
import ExpeditionScreen from './components/expedition/ExpeditionScreen';
import GameScreen from './components/GameScreen';
import { startGameLoop } from './store/gameLoop';
import { selectIsOnExpedition } from './store/expeditionSelectors';
import { useGameStore } from './store/useGameStore';

// =============================================================================
// =============================================================================
// T E L A   P R I N C I P A L

const DEBUG_PARAMETER = 'debug';

// Liga o laço do jogo uma vez e desliga ao sair
export default function App() {
  const isDebug = new URLSearchParams(window.location.search).has(DEBUG_PARAMETER);

  useEffect(() => startGameLoop(), []);

  return isDebug ? <DebugView /> : <PlayScreen />;
}

// Clareira ou expedição, conforme o estado do jogo
function PlayScreen() {
  const isOnExpedition = useGameStore(selectIsOnExpedition);
  return isOnExpedition ? <ExpeditionScreen /> : <GameScreen />;
}
