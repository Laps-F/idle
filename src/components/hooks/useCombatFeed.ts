/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/hooks/useCombatFeed.ts
 * O que faz: avisa um componente a cada tick que trouxe eventos de combate
 * (golpes, derrotas, itens). O aviso chega por fora do React: o componente
 * decide o que fazer, como criar um número flutuante ou somar uma linha ao
 * registro, sem ser redesenhado só porque um tick aconteceu.
 */

import { useEffect, useRef } from 'react';

import { toCombatFeed } from '../../store/eventViews';
import type { CombatFeed } from '../../store/eventViews';
import { useGameStore } from '../../store/useGameStore';

// =============================================================================
// =============================================================================
// E V E N T O S   D E   C O M B A T E

/**
 * Chama "onFeed" sempre que um tick deixar eventos de combate.
 *
 * @param onFeed Recebe os golpes, as Patacas ganhas e as linhas do registro do tick.
 *               Pode ser uma função nova a cada desenho: a mais recente é a usada.
 *
 * Casos de borda: tick sem eventos não chama nada. Com a aba em segundo plano a
 * store não entrega eventos (o intervalo é longo demais para animar), então nada
 * chega até a pessoa voltar.
 */
export function useCombatFeed(onFeed: (feed: CombatFeed) => void): void {
  const latestOnFeed = useRef(onFeed);

  useEffect(() => {
    latestOnFeed.current = onFeed;
  }, [onFeed]);

  useEffect(() => {
    return useGameStore.subscribe((snapshot, previousSnapshot) => {
      const events = snapshot.combatEvents;
      const hasNewEvents = events !== previousSnapshot.combatEvents && events.length > 0;

      if (hasNewEvents) {
        latestOnFeed.current(toCombatFeed(events));
      }
    });
  }, []);
}
