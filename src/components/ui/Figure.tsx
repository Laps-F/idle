/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/ui/Figure.tsx
 * O que faz: mostra a xilogravura de um encantado ou inimigo. A tinta usa a
 * cor do texto e os cortes usam a cor do papel onde a figura está, informada
 * em "paper". O filtro "xilo" dá a borda irregular de madeira entalhada.
 */

import type { CSSProperties } from 'react';

import { getFigureArt } from '../art/figures';

// =============================================================================
// =============================================================================
// F I G U R A

// Id do filtro SVG definido uma vez em XiloFilter
const XILO_FILTER_ID = 'xilo';

interface FigureProps {
  figureId: string; // id do encantado ou do inimigo em src/data
  label: string; // nome lido por leitores de tela
  paper: string; // cor do papel de fundo, usada nos cortes
  className?: string;
}

// Xilogravura do id pedido
export function Figure({ figureId, label, paper, className }: FigureProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={label}
      className={className}
      style={{ '--corte': paper } as CSSProperties}
    >
      <g fill="currentColor" filter={`url(#${XILO_FILTER_ID})`}>
        {getFigureArt(figureId)}
      </g>
    </svg>
  );
}

// Filtro que entorta de leve as bordas, como tinta em madeira. Coloque uma vez na página.
export function XiloFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <filter id={XILO_FILTER_ID} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" />
        <feDisplacementMap in="SourceGraphic" scale="2.6" />
      </filter>
    </svg>
  );
}
