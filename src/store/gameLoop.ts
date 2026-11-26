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
 * Ritmo: na clareira o laço roda a cada tickIntervalMs (100 ms). Durante uma
 * expedição ele acelera para expeditionTickIntervalMs (16 ms), para a
 * personagem andar suave, e volta ao ritmo normal quando a expedição acaba.
 * O desenho do mapa é feito à parte, no canvas, com requestAnimationFrame.
 *
 * Mapa:
 *   1. Laço do jogo
 *   2. Passos do laço
 */

import { BALANCE } from '../data/balance';
import { claimActiveTab } from './tabGuard';
import { useGameStore } from './useGameStore';

// =============================================================================
// =============================================================================
// L A Ç O   D O   J O G O

// Liga o laço e devolve a função que desliga. Use dentro de um useEffect.
export function startGameLoop(): () => void {
  let intervalId = 0;
  let intervalMs = 0;

  // Troca o intervalo quando a expedição começa ou acaba
  const adjustInterval = (): void => {
    const wantedMs = getTickIntervalMs();

    if (wantedMs !== intervalMs) {
      window.clearInterval(intervalId);
      intervalMs = wantedMs;
      intervalId = window.setInterval(runTick, wantedMs);
    }
  };

  runTick();
  adjustInterval();
  const stopWatchingStore = useGameStore.subscribe(adjustInterval);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', saveProgress);
  window.addEventListener('beforeunload', saveProgress);

  const stopTicking = (): void => {
    stopWatchingStore();
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

// Intervalo do laço agora: mais curto durante a expedição
function getTickIntervalMs(): number {
  const isOnExpedition = useGameStore.getState().expedition !== null;
  return isOnExpedition ? BALANCE.expeditionTickIntervalMs : BALANCE.tickIntervalMs;
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
