/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/header/AppHeader.tsx
 * O que faz: o cabeçalho da tela. Junta o nome do jogo (com a edição do
 * folheto, depois da primeira Rebrota), os recursos, o lugar onde a comitiva
 * está e os controles de salvamento.
 */

import { useGameStore } from '../../store/useGameStore';
import { ResourceBar } from './ResourceBar';
import { SaveMenu } from './SaveMenu';
import { StageBadge } from './StageBadge';

// =============================================================================
// =============================================================================
// C A B E Ç A L H O

const ROW_CLASS = 'flex flex-wrap items-center justify-between gap-x-5 gap-y-2';

// Faixa do topo, em duas linhas: em cima o nome do jogo e onde a comitiva está,
// embaixo os recursos e os controles de salvamento. Cada parte lê da store só o que mostra.
export function AppHeader() {
  const edition = useGameStore((store) => store.edition);

  return (
    <header className="space-y-2 border-2 border-tinta bg-jornal px-3 py-2">
      <div className={ROW_CLASS}>
        <p className="font-display text-2xl leading-none">
          Encantados
          {edition > 1 && (
            <span className="ml-2 align-middle font-sans text-sm font-bold">Edição {edition}</span>
          )}
        </p>
        <StageBadge />
      </div>
      <div className={ROW_CLASS}>
        <ResourceBar />
        <SaveMenu />
      </div>
    </header>
  );
}
