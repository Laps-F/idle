/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/GameScreen.tsx
 * O que faz: a tela do jogo, em um painel só. Monta o cabeçalho, a arena no
 * centro e os dois painéis de abas nas laterais, e abre as janelas que
 * dependem do estado: escolha inicial, boas-vindas de volta, cerimônia da
 * Rebrota e aviso de outra aba.
 *
 * Este componente lê pouco da store (bioma, fase do dia e três sinais de sim
 * ou não), então quase nunca redesenha. Cada painel cuida da própria leitura.
 *
 * Árvore de componentes:
 *
 *   GameScreen
 *   ├─ AppHeader
 *   │  ├─ ResourceBar            Patacas, Raízes, Cavacos e Oferendas
 *   │  ├─ StageBadge             zona, estágio e relógio do sertão
 *   │  └─ SaveMenu               Exportar, Importar e Apagar tudo
 *   │     └─ ExportModal, ImportModal, ResetModal
 *   ├─ ArenaPanel                centro
 *   │  ├─ EnemyCover             capa do folheto
 *   │  │  ├─ EnemyFigure         xilogravura e nome do inimigo
 *   │  │  ├─ EnemyHealth         barra de vida
 *   │  │  ├─ BossTimer           tempo do chefe (barra por ref)
 *   │  │  ├─ BossTrack           visagens até o chefe
 *   │  │  └─ FloatingTextLayer   números que sobem (fora do React)
 *   │  ├─ AttackBars             barras de ataque (por ref)
 *   │  └─ EventLog               registro compacto
 *   ├─ Tabs "Comitiva"           lateral esquerda
 *   │  ├─ PartyPanel             elenco e sinergias
 *   │  ├─ AlmanacPanel           pactos
 *   │  └─ JuazeiroPanel          Rebrota e juazeiro (aparece no primeiro muro)
 *   │     ├─ JuazeiroTree        desenho da árvore, que cresce com os nós
 *   │     └─ RebrotaConfirmModal o que fica e o que recomeça
 *   ├─ Tabs "Progresso"          lateral direita
 *   │  ├─ UpgradesPanel          melhorias
 *   │  ├─ StagesPanel            estágios e chefe
 *   │  └─ AmuletsPanel           quem veste, mochila, entalhe e desmanche
 *   └─ janelas: StarterModal, OfflineModal, RebrotaCeremony, OtherTabNotice
 *
 * Mapa:
 *   1. Tela
 *   2. Painéis de abas
 *   3. Papel da capa
 */

import type { CSSProperties } from 'react';

import {
  selectBadges,
  selectClockView,
  selectHasStarter,
  selectIsJuazeiroRevealed,
  selectIsOpenInAnotherTab,
  selectStageView,
} from '../store/selectors';
import { useGameStore } from '../store/useGameStore';
import { ArenaPanel } from './arena/ArenaPanel';
import { AppHeader } from './header/AppHeader';
import { OfflineModal } from './modals/OfflineModal';
import { OtherTabNotice } from './modals/OtherTabNotice';
import { StarterModal } from './modals/StarterModal';
import { AlmanacPanel } from './party/AlmanacPanel';
import { PartyPanel } from './party/PartyPanel';
import { AmuletsPanel } from './progress/AmuletsPanel';
import { StagesPanel } from './progress/StagesPanel';
import { UpgradesPanel } from './progress/UpgradesPanel';
import { JuazeiroPanel } from './rebrota/JuazeiroPanel';
import { RebrotaCeremony } from './rebrota/RebrotaCeremony';
import { COVER_PAPER, NIGHT_COVER_MIX } from './theme';
import { XiloFilter } from './ui/Figure';
import { Tabs } from './ui/Tabs';

// =============================================================================
// =============================================================================
// T E L A

// Em telas largas: comitiva à esquerda, arena no centro, progresso à direita.
// Em telas estreitas tudo empilha, com a arena em cima.
const GRID_CLASS =
  'grid min-h-0 flex-1 gap-3 ' +
  'lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,21rem)] lg:grid-rows-[minmax(0,1fr)]';

// Em telas largas a tela ocupa exatamente a altura da janela e cada painel rola por dentro
const SCREEN_CLASS = 'mx-auto flex min-h-dvh max-w-7xl flex-col gap-3 p-3 lg:h-dvh';

// Tela inteira do jogo
export default function GameScreen() {
  const coverStyle = useCoverStyle();
  const hasStarter = useGameStore(selectHasStarter);
  const isOpenInAnotherTab = useGameStore(selectIsOpenInAnotherTab);

  return (
    <div className={SCREEN_CLASS} style={coverStyle}>
      <XiloFilter />
      <AppHeader />
      <main className={GRID_CLASS}>
        <ArenaPanel className="lg:order-2" />
        <PartyTabs />
        <ProgressTabs />
      </main>

      {!hasStarter && !isOpenInAnotherTab && <StarterModal />}
      {hasStarter && !isOpenInAnotherTab && <OfflineModal />}
      {hasStarter && !isOpenInAnotherTab && <RebrotaCeremony />}
      {isOpenInAnotherTab && <OtherTabNotice />}
    </div>
  );
}


// =============================================================================
// =============================================================================
// P A I N É I S   D E   A B A S

// Lateral esquerda: quem luta, quem ainda pode ser conquistado e o que fica entre edições.
// A aba do juazeiro só entra depois do primeiro muro (selectIsJuazeiroRevealed).
function PartyTabs() {
  const badges = useGameStore(selectBadges);
  const isJuazeiroRevealed = useGameStore(selectIsJuazeiroRevealed);
  const juazeiroTab = {
    id: 'juazeiro',
    title: 'Juazeiro',
    badge: badges.juazeiro,
    badgeLabel: 'novidades no juazeiro',
    content: <JuazeiroPanel />,
  };

  return (
    <Tabs
      label="Comitiva"
      className="lg:order-1"
      tabs={[
        { id: 'comitiva', title: 'Comitiva', content: <PartyPanel /> },
        {
          id: 'almanaque',
          title: 'Almanaque',
          badge: badges.sealablePacts,
          badgeLabel: 'pactos prontos para fechar',
          content: <AlmanacPanel />,
        },
        ...(isJuazeiroRevealed ? [juazeiroTab] : []),
      ]}
    />
  );
}

// Lateral direita: onde gastar as Patacas e para onde ir
function ProgressTabs() {
  const badges = useGameStore(selectBadges);

  return (
    <Tabs
      label="Progresso"
      className="lg:order-3"
      tabs={[
        {
          id: 'melhorias',
          title: 'Melhorias',
          badge: badges.buyableUpgrades,
          badgeLabel: 'melhorias que dá para comprar',
          content: <UpgradesPanel />,
        },
        { id: 'estagios', title: 'Estágios', content: <StagesPanel /> },
        {
          id: 'amuletos',
          title: 'Amuletos',
          badge: badges.wearableAmulets,
          badgeLabel: 'amuletos que dá para vestir',
          content: <AmuletsPanel />,
        },
      ]}
    />
  );
}


// =============================================================================
// =============================================================================
// P A P E L   D A   C A P A

// Cor do papel da capa: a do bioma de dia e a mesma, puxada para o anil, de noite.
// A cor vai em uma variável de CSS, que a capa e as figuras usam.
function useCoverStyle(): CSSProperties {
  const biome = useGameStore((store) => selectStageView(store).biome);
  const dayPhase = useGameStore((store) => selectClockView(store).dayPhase);
  const cover = dayPhase === 'noite' ? NIGHT_COVER_MIX : 'var(--capa-dia)';

  return { '--capa-dia': COVER_PAPER[biome], '--capa': cover } as CSSProperties;
}
