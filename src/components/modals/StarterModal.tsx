/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/modals/StarterModal.tsx
 * O que faz: a primeira tela de um jogo novo. Apresenta os três encantados
 * iniciais, cada um com a xilogravura, a quadra de cordel e o jeito de lutar,
 * e pede uma escolha. Não tem como fechar sem escolher, porque o jogo fica
 * parado até a comitiva ter alguém.
 */

import { selectStarterOptions } from '../../store/selectors';
import type { StarterOptionView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatDecimal } from '../../utils/format';
import { ORIGIN_LABELS } from '../theme';
import { Button } from '../ui/Button';
import { Figure } from '../ui/Figure';
import { Modal } from './Modal';

// =============================================================================
// =============================================================================
// E S C O L H A   I N I C I A L

// Três opções lado a lado (ou empilhadas, em tela estreita)
export function StarterModal() {
  const starters = useGameStore(selectStarterOptions);

  return (
    <Modal title="Quem começa com você?" width="wide">
      <p className="mb-3 text-sm">
        O Estio está secando a mata e apagando as lendas. Escolha um encantado para abrir a sua
        comitiva. Os outros você conquista pelo caminho, por pacto.
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {starters.map((starter) => (
          <StarterOption key={starter.id} starter={starter} />
        ))}
      </ul>
    </Modal>
  );
}

// Frase do jeito de lutar: quanto bate e de quanto em quanto tempo
function describeFightingStyle(starter: StarterOptionView): string {
  const attack = formatDecimal(starter.baseAttack);
  const interval = formatDecimal(starter.attackInterval);
  return `${attack} de ataque a cada ${interval} s`;
}

// Figura, quadra, jeito de lutar e o botão de escolher
function StarterOption({ starter }: { starter: StarterOptionView }) {
  const chooseStarter = useGameStore((store) => store.chooseStarter);

  return (
    <li className="flex flex-col border-2 border-tinta bg-[var(--capa)] p-3 text-center">
      <Figure
        figureId={starter.id}
        label={starter.name}
        paper="var(--capa)"
        className="mx-auto h-28 w-28"
      />
      <p className="font-display text-xl leading-tight">{starter.name}</p>
      <p className="text-xs font-semibold">{ORIGIN_LABELS[starter.origin]}</p>
      <p className="my-2 flex-1 whitespace-pre-line text-xs italic leading-snug">{starter.verse}</p>
      <p className="text-xs">{describeFightingStyle(starter)}</p>
      <Button variant="solid" className="mt-2" onClick={() => chooseStarter(starter.id)}>
        Começar com {starter.name}
      </Button>
    </li>
  );
}
