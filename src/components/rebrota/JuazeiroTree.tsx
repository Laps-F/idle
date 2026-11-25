/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/rebrota/JuazeiroTree.tsx
 * O que faz: desenha o juazeiro em xilogravura. Cada galho (Força, Vento e Lua)
 * fica mais escuro conforme os nós dele são comprados, e as raízes embaixo da
 * terra aumentam com as Raízes fincadas.
 *
 * Componente burro: recebe o crescimento de cada galho (de 0 a 1) e quantas
 * Raízes estão fincadas. Não lê a store.
 *
 * Mapa:
 *   1. Constantes
 *   2. Árvore
 *   3. Partes do desenho
 */

import type { JuazeiroBranchView } from '../../store/selectors';

// =============================================================================
// =============================================================================
// C O N S T A N T E S

type BranchId = JuazeiroBranchView['id'];

const MIN_BRANCH_OPACITY = 0.2; // galho sem nenhum nó comprado ainda aparece, bem claro
const MAX_ROOT_LINES = 9; // raízes desenhadas embaixo da terra, no máximo
const ROOTS_PER_LINE = 3; // uma linha de raiz a cada 3 Raízes fincadas

// Traçado de cada galho e da copa dele, na prancha de 200 por 150
const BRANCH_PATHS: Record<BranchId, { limb: string; crown: [number, number, number][] }> = {
  forca: {
    limb: 'M100 92 C88 80 70 66 46 50',
    crown: [
      [44, 44, 15],
      [30, 54, 11],
      [58, 36, 10],
    ],
  },
  vento: {
    limb: 'M100 96 C100 70 101 46 100 24',
    crown: [
      [100, 20, 16],
      [86, 30, 10],
      [114, 30, 10],
    ],
  },
  lua: {
    limb: 'M100 92 C112 80 130 66 154 50',
    crown: [
      [156, 44, 15],
      [170, 54, 11],
      [142, 36, 10],
    ],
  },
};


// =============================================================================
// =============================================================================
// Á R V O R E

interface JuazeiroTreeProps {
  growth: Record<BranchId, number>; // de 0 a 1 por galho
  roots: number; // Raízes fincadas
  className?: string;
}

// O juazeiro inteiro: raízes, tronco e os três galhos
export function JuazeiroTree({ growth, roots, className }: JuazeiroTreeProps) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="O juazeiro">
      <g fill="currentColor" stroke="currentColor" filter="url(#xilo)">
        <RootLines count={Math.min(MAX_ROOT_LINES, Math.ceil(roots / ROOTS_PER_LINE))} />
        <path d="M0 118 L200 118" strokeWidth={3} fill="none" />
        <path d="M93 118 C95 104 96 96 100 88 C104 96 105 104 107 118 Z" strokeWidth={2} />
        <Branch id="forca" growth={growth.forca} />
        <Branch id="vento" growth={growth.vento} />
        <Branch id="lua" growth={growth.lua} />
      </g>
    </svg>
  );
}


// =============================================================================
// =============================================================================
// P A R T E S   D O   D E S E N H O

// Um galho com a copa. Escurece conforme cresce. A raiz quadrada faz os primeiros nós
// já mudarem o desenho de forma visível, em vez de só no fim do galho.
function Branch({ id, growth }: { id: BranchId; growth: number }) {
  const { limb, crown } = BRANCH_PATHS[id];
  const opacity = MIN_BRANCH_OPACITY + (1 - MIN_BRANCH_OPACITY) * Math.sqrt(growth);

  return (
    <g className="branch-grow" opacity={opacity}>
      <path d={limb} fill="none" strokeWidth={6} strokeLinecap="round" />
      {crown.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} stroke="none" />
      ))}
    </g>
  );
}

// Raízes embaixo da terra, abrindo em leque a partir do tronco
function RootLines({ count }: { count: number }) {
  const lines = Array.from({ length: count }, (_, index) => {
    const spread = count === 1 ? 0 : index / (count - 1) - 0.5; // de -0,5 a 0,5
    const endX = 100 + spread * 150;
    const endY = 132 + Math.abs(spread) * 8 + (index % 2) * 6;
    return `M100 118 Q${100 + spread * 40} 128 ${endX} ${endY}`;
  });

  return (
    <g fill="none" strokeWidth={2} strokeLinecap="round">
      {lines.map((line) => (
        <path key={line} d={line} />
      ))}
    </g>
  );
}
