/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/expedition/ExpeditionCanvas.tsx
 * O que faz: o canvas da expedição. A cada quadro do navegador
 * (requestAnimationFrame), lê a store por fora do React e manda desenhar
 * (mapRenderer.ts). Também transforma os eventos do tick em números que
 * sobem: o dano de cada acerto e, em vermelho, o dano que a personagem leva.
 *
 * Com a expedição pausada, um aviso cobre o mapa. Um clique nele (ou qualquer
 * tecla, em useExpeditionKeyboard) continua. O aviso é React comum: só muda ao
 * pausar e ao continuar.
 *
 * Por que fora do React: a personagem e as visagens mudam de lugar a cada
 * tick, perto de 60 vezes por segundo. Passar isso por estado do React
 * redesenharia a tela inteira. O componente é montado uma vez e só o canvas muda.
 *
 * Mapa:
 *   1. Canvas
 *   2. Aviso de pausa
 *   3. Efeitos
 */

import { useEffect, useRef } from 'react';

import {
  readSceneFrame,
  selectExpeditionMapView,
  selectIsExpeditionPaused,
} from '../../store/expeditionSelectors';
import type { SceneEventView } from '../../store/expeditionSelectors';
import { useGameStore } from '../../store/useGameStore';
import { formatNumber } from '../../utils/format';
import {
  drawExpedition,
  EFFECT_COLORS,
  EFFECT_SECONDS,
  VIEW_HEIGHT_PX,
  VIEW_WIDTH_PX,
} from './mapRenderer';
import type { MapEffect } from './mapRenderer';

// =============================================================================
// =============================================================================
// C A N V A S

const MS_PER_SECOND = 1000;

// Mapa da expedição, desenhado no canvas. Ocupa a largura toda e mantém a proporção.
export function ExpeditionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d') ?? null;

    // Sem canvas de verdade (navegador muito antigo ou teste automático), não há o que desenhar
    if (context === null) {
      return undefined;
    }

    const effects: MapEffect[] = [];
    let lastTime = performance.now();
    let frameId = 0;

    const drawFrame = (time: number): void => {
      const elapsedSeconds = (time - lastTime) / MS_PER_SECOND;
      lastTime = time;
      ageEffects(effects, elapsedSeconds);

      const snapshot = useGameStore.getState();
      const map = selectExpeditionMapView(snapshot);

      if (map !== null) {
        drawExpedition(context, map, readSceneFrame(snapshot), effects);
      }
      frameId = requestAnimationFrame(drawFrame);
    };

    const stopListening = useGameStore.subscribe((snapshot, previous) => {
      if (snapshot.sceneEvents !== previous.sceneEvents) {
        effects.push(...snapshot.sceneEvents.flatMap(toEffect));
      }
    });

    frameId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(frameId);
      stopListening();
    };
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={VIEW_WIDTH_PX}
        height={VIEW_HEIGHT_PX}
        className="block h-auto w-full border-2 border-tinta bg-tinta"
        aria-label="Mapa da expedição. Ande com as setas ou com W, A, S e D."
        role="img"
      />
      <PauseNotice />
    </div>
  );
}


// =============================================================================
// =============================================================================
// A V I S O   D E   P A U S A

// O aviso cobre o mapa inteiro, com a tinta transparente por cima
const PAUSE_NOTICE_CLASS =
  'absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 ' +
  'bg-tinta/70 p-4 text-center text-jornal';

const PAUSE_BUTTON_CLASS =
  'border-2 border-jornal bg-jornal px-3 py-1.5 text-sm font-semibold text-tinta ' +
  'hover:bg-jornal/85';

// Cobre o mapa enquanto a expedição está pausada. Clicar em qualquer ponto continua.
function PauseNotice() {
  const isPaused = useGameStore(selectIsExpeditionPaused);
  const resumeExpedition = useGameStore((store) => store.resumeExpedition);

  if (!isPaused) {
    return null;
  }

  return (
    <div
      className={PAUSE_NOTICE_CLASS}
      role="dialog"
      aria-label="Expedição pausada"
      onClick={resumeExpedition}
    >
      <p className="font-display text-3xl leading-none">Pausado</p>
      <p className="text-sm">
        O tempo, as visagens e as recargas pararam. A clareira continua rendendo.
      </p>
      <button type="button" className={PAUSE_BUTTON_CLASS}>
        Continuar (qualquer tecla ou clique)
      </button>
    </div>
  );
}


// =============================================================================
// =============================================================================
// E F E I T O S

// Evento do tick -> número na tela. A derrota não vira número (a visagem só some).
function toEffect(event: SceneEventView): MapEffect[] {
  switch (event.type) {
    case 'hit': {
      const damage = formatNumber(event.damage);
      return [
        {
          x: event.x,
          y: event.y - 0.4,
          text: event.isCrit ? `${damage}!` : damage,
          color: event.isCrit ? EFFECT_COLORS.crit : EFFECT_COLORS.hit,
          isBig: event.isCrit,
          ageSeconds: 0,
        },
      ];
    }
    case 'hurt':
      return [
        {
          x: event.x,
          y: event.y - 0.6,
          text: `-${formatNumber(event.damage)}`,
          color: EFFECT_COLORS.hurt,
          isBig: true,
          ageSeconds: 0,
        },
      ];
    case 'trail':
      return [
        {
          x: event.x,
          y: event.y - 0.4,
          text: '+1 Rastro',
          color: EFFECT_COLORS.trail,
          isBig: true,
          ageSeconds: 0,
        },
      ];
    case 'defeat':
      return [];
  }
}

// Envelhece os efeitos e tira os que já sumiram. Altera a lista recebida.
function ageEffects(effects: MapEffect[], elapsedSeconds: number): void {
  for (const effect of effects) {
    effect.ageSeconds += elapsedSeconds;
  }

  const alive = effects.filter((effect) => effect.ageSeconds < EFFECT_SECONDS);
  effects.splice(0, effects.length, ...alive);
}
