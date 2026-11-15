/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/header/StageBadge.tsx
 * O que faz: mostra onde a comitiva está (zona e estágio) e a hora do relógio
 * do sertão (dia ou noite, e a lua).
 */

import { Moon, Sun } from 'lucide-react';

import { selectClockView, selectStageView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { DAY_PHASE_LABELS, MOON_PHASE_LABELS } from '../theme';

// =============================================================================
// =============================================================================
// Z O N A ,   E S T Á G I O   E   R E L Ó G I O

const ICON_SIZE = 18;

// Zona e estágio à esquerda, hora do sertão à direita
export function StageBadge() {
  const stage = useGameStore(selectStageView);
  const clock = useGameStore(selectClockView);
  const ClockIcon = clock.dayPhase === 'dia' ? Sun : Moon;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <p>
        <span className="font-bold">{stage.zoneName}</span>, estágio {stage.stage}
      </p>
      <p className="flex items-center gap-1.5">
        <ClockIcon size={ICON_SIZE} aria-hidden="true" />
        {DAY_PHASE_LABELS[clock.dayPhase]}, {MOON_PHASE_LABELS[clock.moonPhase]}
      </p>
    </div>
  );
}
