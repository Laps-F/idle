/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/gameLoop.ts
 * O que faz: liga o laço do jogo. Chama o tick da store em intervalos curtos,
 * garante a gravação quando a aba é escondida ou fechada e para tudo se o
 * jogo for aberto em outra aba.
 *
 * Por que setInterval e não requestAnimationFrame: o requestAnimationFrame
 * para em abas escondidas, e um idle precisa continuar andando. O intervalo
 * do setInterval também não é confiável (o navegador atrasa abas em segundo
 * plano), mas isso não atrapalha: o tick mede o tempo real que passou em vez
 * de supor que foram 100 ms. O desenho fica com o React e com CSS.
 *
 * Motor: quem liga o laço diz qual motor ele roda. No mundo aberto o intervalo
 * é bem menor (worldTickIntervalMs), para a personagem andar suave. O desenho
 * do mapa é feito à parte, no canvas, com requestAnimationFrame.
 *
 * Mapa:
 *   1. Laço do jogo
 *   2. Passos do laço
 */

import { BALANCE } from '../data/balance';
import { claimActiveTab } from './tabGuard';
import type { GameEngine } from './types';
import { useGameStore } from './useGameStore';

// =============================================================================
// =============================================================================
// L A Ç O   D O   J O G O

// Intervalo do laço de cada motor
const TICK_INTERVAL_MS: Record<GameEngine, number> = {
  mundo: BALANCE.worldTickIntervalMs,
  estagios: BALANCE.tickIntervalMs,
};

// Liga o laço com o motor pedido e devolve a função que desliga. Use dentro de um useEffect.
export function startGameLoop(engine: GameEngine = 'estagios'): () => void {
  useGameStore.getState().setEngine(engine);
  runTick();
  const intervalId = window.setInterval(runTick, TICK_INTERVAL_MS[engine]);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', saveProgress);
  window.addEventListener('beforeunload', saveProgress);

  const stopTicking = (): void => {
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', saveProgress);
    window.removeEventListener('beforeunload', saveProgress);
  };

  const stopWatchingTabs = claimActiveTab(() => {
    // A ordem importa: primeiro para de gravar, depois desliga o laço
    useGameStore.getState().yieldToAnotherTab();
    stopTicking();
  });

  return () => {
    stopWatchingTabs();
    stopTicking();
    saveProgress();
  };
}


// =============================================================================
// =============================================================================
// P A S S O S   D O   L A Ç O

// Um passo do jogo, medido pelo relógio real
function runTick(): void {
  useGameStore.getState().tick(Date.now());
}

// Simula até agora e grava no localStorage sem esperar o intervalo de gravação
function saveProgress(): void {
  runTick();
  useGameStore.getState().saveNow();
}

// Aba escondida: grava, porque ela pode ser fechada sem aviso. Aba de volta: atualiza na hora.
function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    saveProgress();
  } else {
    runTick();
  }
}
