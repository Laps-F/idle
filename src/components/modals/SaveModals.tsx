/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/modals/SaveModals.tsx
 * O que faz: as três janelas de salvamento.
 *   - ExportModal mostra o código do jogo para copiar.
 *   - ImportModal recebe um código e troca o jogo atual por ele.
 *   - ResetModal apaga tudo, depois de duas confirmações.
 *
 * Mapa:
 *   1. Constantes
 *   2. Exportar
 *   3. Importar
 *   4. Apagar tudo
 */

import { useState } from 'react';

import { useGameStore } from '../../store/useGameStore';
import { Button } from '../ui/Button';
import { Modal } from './Modal';

// =============================================================================
// =============================================================================
// C O N S T A N T E S

const TEXTAREA_CLASS = 'h-32 w-full border-2 border-tinta bg-white p-2 font-mono text-xs';
const ACTIONS_CLASS = 'mt-4 flex flex-wrap justify-end gap-2';
const MESSAGE_CLASS = 'mt-2 min-h-6 text-sm font-semibold';

const COPY_MESSAGES = {
  copied: 'Código copiado.',
  notCopied: 'Não deu para copiar sozinho. Selecione o texto da caixa e copie.',
} as const;

interface ClosableProps {
  onClose: () => void;
}


// =============================================================================
// =============================================================================
// E X P O R T A R

interface ExportModalProps extends ClosableProps {
  code: string; // código do jogo, gerado pela store na hora em que a janela abriu
}

// Mostra o código do jogo e copia para a área de transferência
export function ExportModal({ code, onClose }: ExportModalProps) {
  const [message, setMessage] = useState('');

  const handleCopy = async (): Promise<void> => {
    const wasCopied = await copyToClipboard(code);
    setMessage(wasCopied ? COPY_MESSAGES.copied : COPY_MESSAGES.notCopied);
  };

  return (
    <Modal title="Exportar o jogo" onClose={onClose}>
      <p className="mb-2 text-sm">
        Este código guarda o seu jogo inteiro. Copie e salve em um lugar seguro. Para voltar a
        ele, use Importar.
      </p>
      <textarea
        className={TEXTAREA_CLASS}
        value={code}
        readOnly
        aria-label="Código do jogo"
        onFocus={(event) => event.target.select()}
      />
      <p className={MESSAGE_CLASS} role="status">
        {message}
      </p>
      <div className={ACTIONS_CLASS}>
        <Button onClick={onClose}>Fechar</Button>
        <Button variant="solid" onClick={() => void handleCopy()}>
          Copiar código
        </Button>
      </div>
    </Modal>
  );
}

// Copia o texto para a área de transferência. Devolve se deu certo.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Sem permissão ou fora de HTTPS: a pessoa copia da caixa de texto
    return false;
  }
}


// =============================================================================
// =============================================================================
// I M P O R T A R

// Recebe um código e troca o jogo atual por ele. Mostra o erro se o código não servir.
export function ImportModal({ onClose }: ClosableProps) {
  const importSave = useGameStore((store) => store.importSave);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const hasCode = code.trim() !== '';

  const handleImport = (): void => {
    const result = importSave(code);

    if (result.ok) {
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <Modal title="Importar um jogo" onClose={onClose}>
      <p className="mb-2 text-sm">
        Cole aqui um código exportado. O jogo atual será trocado pelo do código, e essa troca
        não tem volta.
      </p>
      <textarea
        className={TEXTAREA_CLASS}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        aria-label="Código para importar"
        placeholder="Cole o código aqui"
      />
      <p className={`${MESSAGE_CLASS} text-urucum`} role="alert">
        {error}
      </p>
      <div className={ACTIONS_CLASS}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="solid" disabled={!hasCode} onClick={handleImport}>
          Importar
        </Button>
      </div>
    </Modal>
  );
}


// =============================================================================
// =============================================================================
// A P A G A R   T U D O

// Apaga o jogo inteiro. Pede duas confirmações: a primeira explica, a segunda executa.
export function ResetModal({ onClose }: ClosableProps) {
  const hardReset = useGameStore((store) => store.hardReset);
  const [isSecondStep, setIsSecondStep] = useState(false);

  const handleReset = (): void => {
    hardReset();
    onClose();
  };

  if (!isSecondStep) {
    return (
      <Modal title="Apagar todo o progresso?" onClose={onClose}>
        <p className="text-sm">
          Isso apaga a comitiva, as Patacas, as melhorias e os estágios liberados. Se quiser
          guardar uma cópia antes, feche esta janela e use Exportar.
        </p>
        <div className={ACTIONS_CLASS}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={() => setIsSecondStep(true)}>
            Quero apagar
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Última confirmação" onClose={onClose}>
      <p className="text-sm">O jogo recomeça do zero e não há como desfazer.</p>
      <div className={ACTIONS_CLASS}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={handleReset}>
          Apagar tudo agora
        </Button>
      </div>
    </Modal>
  );
}
