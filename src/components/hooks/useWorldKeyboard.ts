/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/hooks/useWorldKeyboard.ts
 * O que faz: transforma as teclas apertadas (setas ou W, A, S e D) na direção
 * em que a personagem anda, e entrega para a store (setWorldInput).
 *
 * As teclas são lidas pela posição no teclado (event.code), então W, A, S e D
 * funcionam igual em qualquer layout. Enquanto a pessoa escreve numa caixa de
 * texto (importar salvamento, por exemplo), as teclas não movem a personagem.
 */

import { useEffect } from 'react';

import { useGameStore } from '../../store/useGameStore';

// =============================================================================
// =============================================================================
// T E C L A D O

// Cada tecla e a direção que ela soma: x para a direita, y para baixo
const KEY_DIRECTIONS: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

/**
 * Liga o teclado à direção da personagem enquanto o componente estiver na tela.
 *
 * Casos de borda: teclas opostas juntas (esquerda e direita) se anulam. Ao
 * trocar de janela ou de aba, as teclas são soltas, porque o navegador não
 * avisa quando elas são soltas fora da página. Ao sair da tela, a personagem para.
 */
export function useWorldKeyboard(): void {
  const setWorldInput = useGameStore((store) => store.setWorldInput);

  useEffect(() => {
    const pressed = new Set<string>();

    const publish = (): void => {
      let moveX = 0;
      let moveY = 0;

      for (const code of pressed) {
        moveX += KEY_DIRECTIONS[code]?.x ?? 0;
        moveY += KEY_DIRECTIONS[code]?.y ?? 0;
      }

      setWorldInput({ moveX: Math.sign(moveX), moveY: Math.sign(moveY) });
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.code in KEY_DIRECTIONS) || isTypingTarget(event.target)) {
        return;
      }

      // As setas rolariam a página
      event.preventDefault();
      pressed.add(event.code);
      publish();
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (pressed.delete(event.code)) {
        publish();
      }
    };

    const releaseAll = (): void => {
      pressed.clear();
      publish();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseAll);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [setWorldInput]);
}

// Diz se a tecla foi apertada dentro de uma caixa de texto
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
