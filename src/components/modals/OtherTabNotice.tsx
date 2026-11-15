/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/modals/OtherTabNotice.tsx
 * O que faz: avisa que o jogo foi aberto em outra aba. Esta aba parou de
 * simular e de gravar, para as duas não apagarem o progresso uma da outra.
 * A saída é recarregar a página, o que devolve o jogo para esta aba.
 */

import { Button } from '../ui/Button';
import { Modal } from './Modal';

// =============================================================================
// =============================================================================
// A V I S O   D E   O U T R A   A B A

// Janela sem botão de fechar: nesta aba, só resta recarregar
export function OtherTabNotice() {
  return (
    <Modal title="O jogo está aberto em outra aba">
      <p className="text-sm">
        Esta aba parou para não apagar o progresso da outra. Para continuar por aqui, recarregue
        a página.
      </p>
      <div className="mt-4 flex justify-end">
        <Button variant="solid" onClick={() => window.location.reload()}>
          Recarregar a página
        </Button>
      </div>
    </Modal>
  );
}
