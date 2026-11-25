/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/rebrota/RebrotaConfirmModal.tsx
 * O que faz: janela que confirma a Rebrota. Mostra quantas Raízes ela rende,
 * o que fica e o que volta ao começo. Só rebrota no botão de confirmar.
 *
 * Componente burro: recebe o ganho e o número da próxima edição por props e
 * chama a ação "rebrota" da store.
 */

import { useGameStore } from '../../store/useGameStore';
import { formatCount } from '../../utils/format';
import { Modal } from '../modals/Modal';
import { Button } from '../ui/Button';

// =============================================================================
// =============================================================================
// J A N E L A

// O que atravessa a Rebrota e o que recomeça. Espelha performRebrota (src/domain/rebrota.ts).
const KEEPS = [
  'Encantados conquistados, Almanaque e Rastros',
  'Amuletos e Cavacos',
  'Raízes, juazeiro e recorde',
];
const RESETS = ['Estágio, Patacas e melhorias', 'Nível dos encantados', 'Oferendas'];

interface RebrotaConfirmModalProps {
  gain: number; // Raízes que esta Rebrota rende
  nextEdition: number;
  onClose: () => void;
}

// Confirmação da Rebrota, com a lista do que fica e do que recomeça
export function RebrotaConfirmModal({ gain, nextEdition, onClose }: RebrotaConfirmModalProps) {
  const rebrota = useGameStore((store) => store.rebrota);

  const confirm = (): void => {
    rebrota();
    onClose();
  };

  return (
    <Modal title="Rebrotar a clareira?" onClose={onClose}>
      <p className="text-sm">
        Começa a edição {nextEdition} do folheto, com{' '}
        <span className="font-bold">{formatCount(gain, 'Raiz', 'Raízes')} a mais</span> fincadas.
      </p>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <ChangeList title="Fica" items={KEEPS} />
        <ChangeList title="Volta ao começo" items={RESETS} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Agora não</Button>
        <Button variant="solid" onClick={confirm}>
          Rebrotar
        </Button>
      </div>
    </Modal>
  );
}

// Uma das duas listas da janela
function ChangeList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="border-2 border-tinta p-2">
      <p className="font-bold">{title}</p>
      <ul className="mt-1 list-disc pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
