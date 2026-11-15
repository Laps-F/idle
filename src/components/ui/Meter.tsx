/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/ui/Meter.tsx
 * O que faz: as barras do jogo. Há duas, com o mesmo desenho:
 *   - Meter: recebe a fração por prop. Para valores que mudam poucas vezes
 *     por segundo (vida, XP).
 *   - LiveMeter: recebe uma função de leitura e se move por ref, sem
 *     redesenhar. Para valores que mudam a cada tick (ataque, tempo do chefe).
 */

import type { GameSnapshot } from '../../store/types';
import { useStoreMeter } from '../hooks/useStoreMeter';

// =============================================================================
// =============================================================================
// B A R R A S

const TRACK_CLASS = 'h-full w-full overflow-hidden border-2 border-tinta bg-jornal';

type MeterTone = 'tinta' | 'urucum';

const FILL_CLASSES: Record<MeterTone, string> = {
  tinta: 'h-full bg-tinta',
  urucum: 'h-full bg-urucum',
};

interface MeterProps {
  fraction: number; // de 0 a 1
  label: string; // o que a barra mede, para leitores de tela
  tone?: MeterTone;
  className?: string; // altura e largura da barra
}

// Barra desenhada pelo React
export function Meter({ fraction, label, tone = 'tinta', className = 'h-3' }: MeterProps) {
  const safeFraction = Number.isFinite(fraction) ? Math.min(Math.max(fraction, 0), 1) : 0;

  return (
    <div
      className={className}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeFraction * 100)}
    >
      <div className={TRACK_CLASS}>
        <div
          className={`meter-fill-soft ${FILL_CLASSES[tone]}`}
          style={{ transform: `scaleX(${safeFraction})` }}
        />
      </div>
    </div>
  );
}

interface LiveMeterProps {
  read: (snapshot: GameSnapshot) => number; // precisa ser uma função estável
  label: string;
  tone?: MeterTone;
  className?: string;
}

// Barra movida por ref. O componente que a usa não redesenha quando o valor muda.
export function LiveMeter({ read, label, tone = 'tinta', className = 'h-3' }: LiveMeterProps) {
  const fillRef = useStoreMeter(read);

  return (
    <div className={className} role="img" aria-label={label}>
      <div className={TRACK_CLASS}>
        <div ref={fillRef} className={`meter-fill ${FILL_CLASSES[tone]}`} />
      </div>
    </div>
  );
}
