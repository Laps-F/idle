/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/App.tsx
 * O que faz: liga o laço do jogo e escolhe a tela. O normal é a tela do jogo.
 * Com "?debug" no endereço (por exemplo, http://localhost:5173/?debug), abre
 * o painel de debug, que mostra os números crus da store.
 */

import { useEffect } from 'react';

import DebugView from './components/DebugView';
import GameScreen from './components/GameScreen';
import { startGameLoop } from './store/gameLoop';

// =============================================================================
// =============================================================================
// T E L A   P R I N C I P A L

const DEBUG_PARAMETER = 'debug';

// Liga o laço do jogo uma vez e desliga ao sair
export default function App() {
  useEffect(() => startGameLoop(), []);

  return isDebugRequested() ? <DebugView /> : <GameScreen />;
}

// Diz se o endereço da página pede o painel de debug
function isDebugRequested(): boolean {
  return new URLSearchParams(window.location.search).has(DEBUG_PARAMETER);
}
