/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/gameLoop.ts
 * O que faz: liga o laço do jogo. Chama o tick da store em intervalos curtos
 * e garante a gravação quando a aba é escondida ou fechada.
 *
 * O intervalo do setInterval não é confiável: o navegador atrasa abas em
 * segundo plano. Isso não atrapalha, porque o tick mede o tempo real que
 * passou em vez de supor que foram 100 ms.
 */

import { BALANCE } from '../data/balance';
import { useGameStore } from './useGameStore';

// =============================================================================
// =============================================================================
// L A Ç O   D O   J O G O

// Liga o laço e devolve a função que desliga. Use dentro de um useEffect.
export function startGameLoop(): () => void {
  runTick();
  const intervalId = window.setInterval(runTick, BALANCE.tickIntervalMs);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', saveProgress);
  window.addEventListener('beforeunload', saveProgress);

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', saveProgress);
    window.removeEventListener('beforeunload', saveProgress);
    saveProgress();
  };
}

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
