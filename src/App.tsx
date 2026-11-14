/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/App.tsx
 * O que faz: liga o laço do jogo e mostra a tela. Por enquanto a tela é o
 * painel de debug. Quando a interface final existir, o painel passa a ser
 * uma opção à parte.
 */

import { useEffect } from 'react';

import DebugView from './components/DebugView';
import { startGameLoop } from './store/gameLoop';

// =============================================================================
// =============================================================================
// T E L A   P R I N C I P A L

// Liga o laço do jogo uma vez e desliga ao sair
export default function App() {
  useEffect(() => startGameLoop(), []);

  return <DebugView />;
}
