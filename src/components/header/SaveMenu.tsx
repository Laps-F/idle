/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/header/SaveMenu.tsx
 * O que faz: os três controles de salvamento do cabeçalho (exportar, importar
 * e apagar tudo) e a janela que cada um abre. O jogo já grava sozinho no
 * navegador. Estes controles servem para guardar uma cópia fora dele, trazer
 * uma cópia de volta ou recomeçar.
 */

import { Download, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';

import { useGameStore } from '../../store/useGameStore';
import { ExportModal, ImportModal, ResetModal } from '../modals/SaveModals';
import { Button } from '../ui/Button';

// =============================================================================
// =============================================================================
// C O N T R O L E S   D E   S A L V A M E N T O

const ICON_SIZE = 16;

type OpenModal = { kind: 'export'; code: string } | { kind: 'import' } | { kind: 'reset' } | null;

// Botões de salvamento e a janela aberta por eles, uma de cada vez
export function SaveMenu() {
  const exportSave = useGameStore((store) => store.exportSave);
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const closeModal = (): void => setOpenModal(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setOpenModal({ kind: 'export', code: exportSave() })}>
        <Download size={ICON_SIZE} aria-hidden="true" />
        Exportar
      </Button>
      <Button onClick={() => setOpenModal({ kind: 'import' })}>
        <Upload size={ICON_SIZE} aria-hidden="true" />
        Importar
      </Button>
      <Button onClick={() => setOpenModal({ kind: 'reset' })}>
        <Trash2 size={ICON_SIZE} aria-hidden="true" />
        Apagar tudo
      </Button>

      {openModal?.kind === 'export' && <ExportModal code={openModal.code} onClose={closeModal} />}
      {openModal?.kind === 'import' && <ImportModal onClose={closeModal} />}
      {openModal?.kind === 'reset' && <ResetModal onClose={closeModal} />}
    </div>
  );
}
