/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/rebrota/RebrotaCeremony.tsx
 * O que faz: a cerimônia da Rebrota. Logo depois de rebrotar, a página do
 * folheto vira e o número da edição nova é carimbado, com as Raízes ganhas.
 * Fecha no botão ou no Esc.
 *
 * A animação é só de CSS (.page-turn e .stamp-late, em src/index.css) e some
 * para quem pediu movimento reduzido.
 */

import { selectRebrotaCeremony } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatCount } from '../../utils/format';
import { Modal } from '../modals/Modal';
import { Button } from '../ui/Button';

// =============================================================================
// =============================================================================
// C E R I M Ô N I A

// Carimbo da edição: urucum, levemente torto, como um carimbo batido à mão
const STAMP_CLASS =
  'stamp-late mx-auto my-4 inline-block -rotate-3 border-4 border-urucum px-4 py-2 ' +
  'font-display text-4xl text-urucum';

// Janela da edição nova. Não aparece fora do momento da Rebrota.
export function RebrotaCeremony() {
  const ceremony = useGameStore(selectRebrotaCeremony);
  const dismiss = useGameStore((store) => store.dismissRebrotaCeremony);

  if (ceremony === null) {
    return null;
  }

  return (
    <Modal title="A clareira rebrotou" onClose={dismiss} panelClassName="page-turn text-center">
      <p className={STAMP_CLASS}>Edição {ceremony.edition}</p>
      <p className="text-sm">
        O Estio levou a clareira, mas as raízes ficaram.{' '}
        <span className="font-bold">
          {formatCount(ceremony.roots, 'Raiz nova fincada', 'Raízes novas fincadas')}
        </span>
        .
      </p>
      <div className="mt-4 flex justify-center">
        <Button variant="solid" onClick={dismiss}>
          Começar a edição {ceremony.edition}
        </Button>
      </div>
    </Modal>
  );
}
