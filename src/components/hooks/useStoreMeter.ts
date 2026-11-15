/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/hooks/useStoreMeter.ts
 * O que faz: move uma barra de progresso direto pelo estilo do elemento, sem
 * redesenhar o componente. É o isolamento das animações de alta frequência.
 *
 * Por que existe: a barra de ataque muda a cada tick (10 vezes por segundo) e
 * deve parecer contínua. Se o valor passasse pelo estado do React, o
 * componente inteiro redesenharia nesse ritmo. Aqui o hook escuta a store por
 * fora do React, escreve o scaleX na barra, e a transição de CSS (classe
 * "meter-fill") suaviza o movimento entre um tick e outro, a 60 quadros por
 * segundo, por conta do navegador.
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { GameSnapshot } from '../../store/types';
import { useGameStore } from '../../store/useGameStore';

// =============================================================================
// =============================================================================
// B A R R A   M O V I D A   P O R   R E F

/**
 * Liga o preenchimento de uma barra a um valor da store.
 *
 * @param read Função que lê da store a fração da barra, de 0 a 1. Precisa ser
 *             estável (definida fora do componente ou com useMemo). Se mudar a
 *             cada desenho, a escuta é refeita à toa.
 * @returns Ref para colocar no elemento de preenchimento, que deve ter a classe "meter-fill".
 *
 * Casos de borda:
 * - Quando o valor cai (a barra encheu e recomeçou), a transição é desligada
 *   naquele passo, para a barra voltar na hora em vez de deslizar para trás.
 * - Valor fora de 0 a 1, NaN ou infinito é limitado ao intervalo.
 * - Se o valor não mudou desde o último passo, o estilo não é tocado.
 */
export function useStoreMeter(
  read: (snapshot: GameSnapshot) => number,
): RefObject<HTMLDivElement | null> {
  const fillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let previousFraction = -1;

    const apply = (snapshot: GameSnapshot): void => {
      const fill = fillRef.current;
      const fraction = clampFraction(read(snapshot));

      if (fill === null || fraction === previousFraction) {
        return;
      }

      const didRestart = fraction < previousFraction;
      fill.style.transition = didRestart ? 'none' : '';
      fill.style.transform = `scaleX(${fraction})`;
      previousFraction = fraction;
    };

    apply(useGameStore.getState());
    return useGameStore.subscribe(apply);
  }, [read]);

  return fillRef;
}

// Mantém a fração entre 0 e 1
function clampFraction(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}
