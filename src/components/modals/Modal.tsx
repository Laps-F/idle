/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/modals/Modal.tsx
 * O que faz: a janela que abre por cima do jogo. Escurece o fundo, recebe o
 * foco do teclado e fecha com Esc quando o fechamento é permitido.
 */

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

// =============================================================================
// =============================================================================
// J A N E L A

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose?: () => void; // sem esse campo, a janela só fecha por um botão do conteúdo
  width?: 'normal' | 'wide';
}

const WIDTH_CLASSES = { normal: 'max-w-md', wide: 'max-w-3xl' } as const;

// Fundo escurecido que cobre a tela. Em tela baixa, a janela rola dentro dele.
const OVERLAY_CLASS =
  'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/70 p-4 ' +
  'sm:items-center';

const PANEL_CLASS = 'w-full border-4 border-tinta bg-jornal p-5 outline-none';

// Janela por cima do jogo, com título e conteúdo
export function Modal({ title, children, onClose, width = 'normal' }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (onClose === undefined) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={OVERLAY_CLASS}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${PANEL_CLASS} ${WIDTH_CLASSES[width]}`}
      >
        <h2 id={titleId} className="mb-3 font-display text-2xl leading-tight">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
