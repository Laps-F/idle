/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/App.tsx
 * O que faz: escolhe a tela pelo endereço e liga o laço do jogo com o motor
 * que essa tela usa.
 *
 *   - Normal: o mundo aberto (protótipo), com o motor "mundo".
 *   - "?classico" (por exemplo, http://localhost:5173/?classico): a tela antiga,
 *     por estágios, com o motor "estagios".
 *   - "?debug": o painel de debug, que mostra os números crus do motor de estágios.
 *
 * O salvamento é o mesmo nas três. Só o motor que roda muda.
 */

import { useEffect } from 'react';

import DebugView from './components/DebugView';
import GameScreen from './components/GameScreen';
import WorldScreen from './components/world/WorldScreen';
import { startGameLoop } from './store/gameLoop';

// =============================================================================
// =============================================================================
// T E L A   P R I N C I P A L

const DEBUG_PARAMETER = 'debug';
const CLASSIC_PARAMETER = 'classico';

type ScreenId = 'mundo' | 'classico' | 'debug';

// Liga o laço do jogo uma vez e desliga ao sair
export default function App() {
  const screen = getRequestedScreen();

  useEffect(() => startGameLoop(screen === 'mundo' ? 'mundo' : 'estagios'), [screen]);

  if (screen === 'debug') {
    return <DebugView />;
  }

  return screen === 'classico' ? <GameScreen /> : <WorldScreen />;
}

// Qual tela o endereço da página pede
function getRequestedScreen(): ScreenId {
  const parameters = new URLSearchParams(window.location.search);

  if (parameters.has(DEBUG_PARAMETER)) {
    return 'debug';
  }

  return parameters.has(CLASSIC_PARAMETER) ? 'classico' : 'mundo';
}
