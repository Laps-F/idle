/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/arena/AttackBars.tsx
 * O que faz: as barras de ação da comitiva. Cada encantado tem uma barra que
 * enche até o próximo golpe.
 *
 * Este componente só redesenha quando a comitiva muda. As barras andam por
 * ref (LiveMeter), a 60 quadros por segundo, sem passar pelo React.
 */

import { useMemo } from 'react';

import { readAttackProgress, selectFighters } from '../../store/selectors';
import type { FighterView } from '../../store/selectors';
import type { GameSnapshot } from '../../store/types';
import { useGameStore } from '../../store/useGameStore';
import { ORIGIN_LABELS } from '../theme';
import { Figure } from '../ui/Figure';
import { LiveMeter } from '../ui/Meter';

// =============================================================================
// =============================================================================
// B A R R A S   D E   A T A Q U E

const LIST_CLASS = 'grid gap-2 border-2 border-tinta bg-jornal p-3 sm:grid-cols-3';

// Uma linha por encantado da comitiva
export function AttackBars() {
  const fighters = useGameStore(selectFighters);

  return (
    <ul className={LIST_CLASS} aria-label="Golpes da comitiva">
      {fighters.map((fighter) => (
        <FighterBar key={fighter.id} fighter={fighter} />
      ))}
    </ul>
  );
}

// Figura, nome e a barra que enche até o próximo golpe
function FighterBar({ fighter }: { fighter: FighterView }) {
  // A função de leitura é criada uma vez por encantado, para a barra não refazer a escuta
  const readProgress = useMemo(
    () => (snapshot: GameSnapshot) => readAttackProgress(snapshot, fighter.id),
    [fighter.id],
  );

  return (
    <li className="flex items-center gap-2">
      <Figure
        figureId={fighter.id}
        label={fighter.name}
        paper="var(--color-jornal)"
        className="h-10 w-10 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">
          {fighter.name}{' '}
          <span className="font-normal text-tinta/70">{ORIGIN_LABELS[fighter.origin]}</span>
        </p>
        <LiveMeter
          read={readProgress}
          label={`Próximo golpe de ${fighter.name}`}
          className="mt-1 h-2.5"
        />
      </div>
    </li>
  );
}
