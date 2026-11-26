/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/expedition/ExpeditionScreen.tsx
 * O que faz: a tela da expedição, que fica no lugar da clareira enquanto há
 * uma expedição em andamento (src/App.tsx decide). Monta o cabeçalho, o mapa
 * no canvas e o painel do lado, e liga o teclado. A clareira continua
 * rendendo por baixo: as Patacas do cabeçalho seguem subindo.
 *
 * Árvore de componentes:
 *
 *   ExpeditionScreen
 *   ├─ cabeçalho
 *   │  ├─ ResourceBar            Patacas, Raízes, Cavacos e Oferendas
 *   │  └─ SaveMenu               Exportar, Importar e Apagar tudo
 *   ├─ ExpeditionCanvas          mapa, efeitos e painel de vida (mapRenderer.ts)
 *   ├─ ExpeditionSidePanel       bolsa, voltar agora, como jogar e legenda das imagens
 *   └─ OtherTabNotice            aviso de jogo aberto em outra aba
 *
 * Mapa:
 *   1. Tela
 */

import { useExpeditionKeyboard } from '../hooks/useExpeditionKeyboard';
import { ResourceBar } from '../header/ResourceBar';
import { SaveMenu } from '../header/SaveMenu';
import { OtherTabNotice } from '../modals/OtherTabNotice';
import { selectIsOpenInAnotherTab } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { XiloFilter } from '../ui/Figure';
import { ExpeditionCanvas } from './ExpeditionCanvas';
import { ExpeditionSidePanel } from './ExpeditionSidePanel';

// =============================================================================
// =============================================================================
// T E L A

const ROW_CLASS = 'flex flex-wrap items-center justify-between gap-x-5 gap-y-2';

// Em telas largas: mapa à esquerda e painel à direita. Em telas estreitas, empilha.
const GRID_CLASS = 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start';

// Tela inteira da expedição
export default function ExpeditionScreen() {
  const isOpenInAnotherTab = useGameStore(selectIsOpenInAnotherTab);
  useExpeditionKeyboard();

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-3 p-3">
      <XiloFilter />
      <header className="space-y-2 border-2 border-tinta bg-jornal px-3 py-2">
        <p className="font-display text-2xl leading-none">
          Encantados
          <span className="ml-2 align-middle font-sans text-sm font-bold">
            em expedição (a clareira continua rendendo)
          </span>
        </p>
        <div className={ROW_CLASS}>
          <ResourceBar />
          <SaveMenu />
        </div>
      </header>

      <main className={GRID_CLASS}>
        <ExpeditionCanvas />
        <ExpeditionSidePanel />
      </main>

      {isOpenInAnotherTab && <OtherTabNotice />}
    </div>
  );
}
