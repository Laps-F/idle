/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/world/WorldScreen.tsx
 * O que faz: a tela do mundo aberto (protótipo). Monta o cabeçalho, o mapa
 * no canvas e o painel do lado, liga o teclado e abre as janelas que dependem
 * do estado: escolha inicial, boas-vindas de volta e aviso de outra aba.
 *
 * Árvore de componentes:
 *
 *   WorldScreen
 *   ├─ cabeçalho
 *   │  ├─ ResourceBar            Patacas, Raízes, Cavacos e Oferendas
 *   │  └─ SaveMenu               Exportar, Importar e Apagar tudo
 *   ├─ WorldCanvas               mapa, desenhado fora do React (worldRenderer.ts)
 *   ├─ WorldSidePanel            personagem, como jogar e legenda das imagens
 *   └─ janelas: StarterModal, OfflineModal, OtherTabNotice
 *
 * Mapa:
 *   1. Tela
 */

import { useWorldKeyboard } from '../hooks/useWorldKeyboard';
import { ResourceBar } from '../header/ResourceBar';
import { SaveMenu } from '../header/SaveMenu';
import { OfflineModal } from '../modals/OfflineModal';
import { OtherTabNotice } from '../modals/OtherTabNotice';
import { StarterModal } from '../modals/StarterModal';
import { selectHasStarter, selectIsOpenInAnotherTab } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { XiloFilter } from '../ui/Figure';
import { WorldCanvas } from './WorldCanvas';
import { WorldSidePanel } from './WorldSidePanel';

// =============================================================================
// =============================================================================
// T E L A

const ROW_CLASS = 'flex flex-wrap items-center justify-between gap-x-5 gap-y-2';

// Em telas largas: mapa à esquerda e painel à direita. Em telas estreitas, empilha.
const GRID_CLASS = 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start';

// Tela inteira do mundo aberto
export default function WorldScreen() {
  const hasStarter = useGameStore(selectHasStarter);
  const isOpenInAnotherTab = useGameStore(selectIsOpenInAnotherTab);
  useWorldKeyboard();

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-3 p-3">
      <XiloFilter />
      <header className="space-y-2 border-2 border-tinta bg-jornal px-3 py-2">
        <div className={ROW_CLASS}>
          <p className="font-display text-2xl leading-none">
            Encantados
            <span className="ml-2 align-middle font-sans text-sm font-bold">
              protótipo do mundo aberto
            </span>
          </p>
        </div>
        <div className={ROW_CLASS}>
          <ResourceBar />
          <SaveMenu />
        </div>
      </header>

      <main className={GRID_CLASS}>
        <WorldCanvas />
        <WorldSidePanel />
      </main>

      {!hasStarter && !isOpenInAnotherTab && <StarterModal />}
      {hasStarter && !isOpenInAnotherTab && <OfflineModal />}
      {isOpenInAnotherTab && <OtherTabNotice />}
    </div>
  );
}
