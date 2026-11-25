/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/world/WorldCanvas.tsx
 * O que faz: o canvas do mapa. A cada quadro do navegador
 * (requestAnimationFrame), lê a store por fora do React e manda desenhar
 * (worldRenderer.ts). Também transforma os golpes do tick em números que sobem.
 *
 * Por que fora do React: a personagem e as visagens mudam de lugar a cada
 * tick, perto de 60 vezes por segundo. Passar isso por estado do React
 * redesenharia a tela inteira. O componente é montado uma vez e só o canvas muda.
 *
 * Mapa:
 *   1. Canvas
 *   2. Números que sobem
 */

import { useEffect, useRef } from 'react';

import { readWorldFrame, selectWorldMapView } from '../../store/selectors';
import type { WorldEventView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatNumber } from '../../utils/format';
import {
  drawWorld,
  FLOATING_TEXT_SECONDS,
  VIEW_HEIGHT_PX,
  VIEW_WIDTH_PX,
} from './worldRenderer';
import type { FloatingText } from './worldRenderer';

// =============================================================================
// =============================================================================
// C A N V A S

const MS_PER_SECOND = 1000;

// Mapa do jogo, desenhado no canvas. Ocupa a largura toda e mantém a proporção.
export function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d') ?? null;

    // Sem canvas de verdade (navegador muito antigo ou teste automático), não há o que desenhar
    if (context === null) {
      return undefined;
    }

    const floatingTexts: FloatingText[] = [];
    let lastTime = performance.now();
    let frameId = 0;

    const drawFrame = (time: number): void => {
      const elapsedSeconds = (time - lastTime) / MS_PER_SECOND;
      lastTime = time;
      ageFloatingTexts(floatingTexts, elapsedSeconds);

      const snapshot = useGameStore.getState();
      drawWorld(context, selectWorldMapView(snapshot), readWorldFrame(snapshot), floatingTexts);
      frameId = requestAnimationFrame(drawFrame);
    };

    const stopListening = useGameStore.subscribe((snapshot, previous) => {
      if (snapshot.worldEvents !== previous.worldEvents) {
        floatingTexts.push(...snapshot.worldEvents.flatMap(toFloatingText));
      }
    });

    frameId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(frameId);
      stopListening();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={VIEW_WIDTH_PX}
      height={VIEW_HEIGHT_PX}
      className="block h-auto w-full border-2 border-tinta bg-tinta"
      aria-label="Mapa do jogo. Ande com as setas ou com W, A, S e D."
      role="img"
    />
  );
}


// =============================================================================
// =============================================================================
// N Ú M E R O S   Q U E   S O B E M

const HIT_COLOR = '#f1ead8';
const CRIT_COLOR = '#e8b93a';

// Golpe vira número. Derrota e troca de mapa não aparecem como número.
function toFloatingText(event: WorldEventView): FloatingText[] {
  if (event.type !== 'hit') {
    return [];
  }

  const damage = formatNumber(event.damage);

  return [
    {
      x: event.x,
      y: event.y - 0.4,
      text: event.isCrit ? `${damage}!` : damage,
      color: event.isCrit ? CRIT_COLOR : HIT_COLOR,
      isBig: event.isCrit,
      ageSeconds: 0,
    },
  ];
}

// Envelhece os números e tira os que já sumiram. Altera a lista recebida.
function ageFloatingTexts(floatingTexts: FloatingText[], elapsedSeconds: number): void {
  for (const floating of floatingTexts) {
    floating.ageSeconds += elapsedSeconds;
  }

  const alive = floatingTexts.filter((floating) => floating.ageSeconds < FLOATING_TEXT_SECONDS);
  floatingTexts.splice(0, floatingTexts.length, ...alive);
}
