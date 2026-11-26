/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/hooks/useExpeditionKeyboard.ts
 * O que faz: liga o teclado à expedição. As setas ou W, A, S e D viram a
 * direção em que a personagem anda (setMoveInput) e a barra de espaço pede o
 * golpe especial (triggerSpecial).
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

// Tecla do golpe especial
const SPECIAL_KEY = 'Space';

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
 * Liga o teclado à expedição enquanto o componente estiver na tela.
 *
 * Casos de borda: teclas opostas juntas (esquerda e direita) se anulam. Ao
 * trocar de janela ou de aba, as teclas são soltas, porque o navegador não
 * avisa quando elas são soltas fora da página. Ao sair da tela, a personagem para.
 */
export function useExpeditionKeyboard(): void {
  const setMoveInput = useGameStore((store) => store.setMoveInput);
  const triggerSpecial = useGameStore((store) => store.triggerSpecial);

  useEffect(() => {
    const pressed = new Set<string>();

    const publish = (): void => {
      let moveX = 0;
      let moveY = 0;

      for (const code of pressed) {
        moveX += KEY_DIRECTIONS[code]?.x ?? 0;
        moveY += KEY_DIRECTIONS[code]?.y ?? 0;
      }

      setMoveInput({ moveX: Math.sign(moveX), moveY: Math.sign(moveY) });
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) {
        return;
      }

      // As setas e o espaço rolariam a página (ou apertariam o botão em foco)
      if (event.code === SPECIAL_KEY) {
        event.preventDefault();
        triggerSpecial();
      } else if (event.code in KEY_DIRECTIONS) {
        event.preventDefault();
        pressed.add(event.code);
        publish();
      }
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
  }, [setMoveInput, triggerSpecial]);
}

// Diz se a tecla foi apertada dentro de uma caixa de texto
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
