/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/hooks/useExpeditionKeyboard.ts
 * O que faz: liga o teclado à expedição. As setas ou W, A, S e D viram a
 * direção em que a personagem anda (setMoveInput), a barra de espaço pede o
 * golpe especial (triggerSpecial) e as teclas 1, 2 e 3 (em cima das letras ou
 * no teclado numérico) pedem para trocar quem está em campo (swapFighter).
 *
 * Pausa: a tecla P pausa a expedição. Com ela pausada (pela tecla, pela aba
 * escondida ou por outra janela), qualquer tecla continua. A tecla que continua
 * não faz mais nada, para a personagem não sair andando ou atirando sem querer.
 * Teclas sozinhas de atalho (Shift, Ctrl, Alt, Tab) não continuam, porque
 * costumam vir antes de trocar de janela.
 *
 * As teclas são lidas pela posição no teclado (event.code), então W, A, S e D
 * funcionam igual em qualquer layout. Enquanto a pessoa escreve numa caixa de
 * texto (importar salvamento, por exemplo), as teclas não movem a personagem.
 */

import { useEffect } from 'react';

import { selectIsExpeditionPaused } from '../../store/expeditionSelectors';
import { useGameStore } from '../../store/useGameStore';

// =============================================================================
// =============================================================================
// T E C L A D O

// Tecla do golpe especial
const SPECIAL_KEY = 'Space';

// Tecla que pausa a expedição
const PAUSE_KEY = 'KeyP';

// Teclas que põem em campo cada um de quem saiu: a posição dele (0 é a tecla 1)
const SWAP_KEYS: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
};

// Teclas que, sozinhas, não continuam a expedição pausada
const MODIFIER_KEYS = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'Tab',
]);

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
  const swapFighter = useGameStore((store) => store.swapFighter);
  const pauseExpedition = useGameStore((store) => store.pauseExpedition);
  const resumeExpedition = useGameStore((store) => store.resumeExpedition);

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
      if (isTypingTarget(event.target) || MODIFIER_KEYS.has(event.code)) {
        return;
      }

      // Pausada: a tecla só continua. As setas e o espaço não rolam a página.
      if (selectIsExpeditionPaused(useGameStore.getState())) {
        event.preventDefault();
        resumeExpedition();
        return;
      }

      // As setas e o espaço rolariam a página (ou apertariam o botão em foco)
      if (event.code === PAUSE_KEY) {
        releaseAll();
        pauseExpedition();
      } else if (event.code === SPECIAL_KEY) {
        event.preventDefault();
        triggerSpecial();
      } else if (event.code in SWAP_KEYS) {
        swapFighter(SWAP_KEYS[event.code] ?? 0);
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
  }, [setMoveInput, triggerSpecial, swapFighter, pauseExpedition, resumeExpedition]);
}

// Diz se a tecla foi apertada dentro de uma caixa de texto
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
