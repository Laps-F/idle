/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/rebrota/JuazeiroPanel.tsx
 * O que faz: a aba do juazeiro. Em cima, o desenho da árvore, a edição e as
 * Raízes. No meio, o quadro da Rebrota: quanto ela rende agora, quando vem a
 * próxima Raiz e o botão de rebrotar. Embaixo, os três galhos com os nós que
 * se compram com Raízes livres.
 *
 * Componente burro: tudo chega pronto do seletor selectJuazeiroPanel. Aqui só
 * se formata texto e se chamam ações da store. Nada desta aba muda a cada
 * tick: ela redesenha quando o estágio máximo, as Raízes ou os nós mudam.
 *
 * Mapa:
 *   1. Painel
 *   2. Raízes e edição
 *   3. Quadro da Rebrota
 *   4. Galhos e nós
 */

import { useState } from 'react';

import { selectJuazeiroPanel } from '../../store/selectors';
import type {
  JuazeiroBranchView,
  JuazeiroNodeView,
  JuazeiroPanelView,
} from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatCount, formatDecimal, formatPercent } from '../../utils/format';
import { Button } from '../ui/Button';
import { JuazeiroTree } from './JuazeiroTree';
import { RebrotaConfirmModal } from './RebrotaConfirmModal';

// =============================================================================
// =============================================================================
// P A I N E L

const SECTION_CLASS = 'border-2 border-tinta p-2';
const SECTION_TITLE_CLASS = 'mb-1 text-sm font-bold';

// "1 Raiz", "12 Raízes"
function formatRoots(amount: number): string {
  return formatCount(amount, 'Raiz', 'Raízes');
}

// Árvore e Raízes, quadro da Rebrota, compra automática e galhos
export function JuazeiroPanel() {
  const panel = useGameStore(selectJuazeiroPanel);

  return (
    <div className="space-y-4 text-sm">
      <RootsSummary panel={panel} />
      <RebrotaBox panel={panel} />
      {panel.hasAutoBuy && <AutoBuySwitch isOn={panel.autoBuy} />}
      {panel.branches.map((branch) => (
        <BranchSection key={branch.id} branch={branch} />
      ))}
    </div>
  );
}


// =============================================================================
// =============================================================================
// R A Í Z E S   E   E D I Ç Ã O

// Desenho do juazeiro, número da edição e as duas contas das Raízes
function RootsSummary({ panel }: { panel: JuazeiroPanelView }) {
  const growth = {
    forca: getGrowth(panel, 'forca'),
    vento: getGrowth(panel, 'vento'),
    lua: getGrowth(panel, 'lua'),
  };

  return (
    <div>
      <JuazeiroTree growth={growth} roots={panel.roots} className="mx-auto h-32 w-full" />
      <p className="font-display text-lg leading-tight">Edição {panel.edition} do folheto</p>
      {panel.roots === 0 ? (
        <p className="text-tinta/70">
          Nenhuma Raiz fincada ainda. Cada Raiz dá +5% de dano e de Patacas para sempre.
        </p>
      ) : (
        <p>
          <span className="font-bold">
            {formatCount(panel.roots, 'Raiz fincada', 'Raízes fincadas')}
          </span>
          : +{formatPercent(panel.rootsBonus)} de dano e de Patacas para sempre.{' '}
          {formatCount(panel.freeRoots, 'Raiz livre', 'Raízes livres')} para o juazeiro.
        </p>
      )}
    </div>
  );
}

// Quanto um galho já cresceu, de 0 a 1
function getGrowth(panel: JuazeiroPanelView, branchId: JuazeiroBranchView['id']): number {
  return panel.branches.find((branch) => branch.id === branchId)?.growth ?? 0;
}


// =============================================================================
// =============================================================================
// Q U A D R O   D A   R E B R O T A

// Quanto a Rebrota rende agora, quando vem a próxima Raiz e o botão de rebrotar
function RebrotaBox({ panel }: { panel: JuazeiroPanelView }) {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div className={SECTION_CLASS}>
      <h3 className={SECTION_TITLE_CLASS}>Rebrota</h3>
      {panel.canRebrota ? <RebrotaReady panel={panel} /> : <RebrotaLocked panel={panel} />}
      {panel.recordStage > 0 && (
        <p className="text-xs text-tinta/70">
          Recorde das edições passadas: estágio {panel.recordStage}.
        </p>
      )}
      <Button
        variant="solid"
        className="mt-2 w-full"
        disabled={!panel.canRebrota}
        onClick={() => setIsConfirming(true)}
      >
        Rebrotar
      </Button>
      {isConfirming && (
        <RebrotaConfirmModal
          gain={panel.gain}
          nextEdition={panel.edition + 1}
          onClose={() => setIsConfirming(false)}
        />
      )}
    </div>
  );
}

// Rebrota liberada: ganho, próxima Raiz e ritmo da edição
function RebrotaReady({ panel }: { panel: JuazeiroPanelView }) {
  return (
    <>
      <p>
        Rebrotar agora rende <span className="font-bold">{formatRoots(panel.gain)}</span>.
      </p>
      <p>A próxima Raiz vem no estágio {panel.nextRootStage}.</p>
      <p className="text-tinta/70">
        Nesta edição: {formatDecimal(panel.rootsPerHour)} Raízes por hora.
      </p>
    </>
  );
}

// Rebrota ainda presa: o estágio que falta
function RebrotaLocked({ panel }: { panel: JuazeiroPanelView }) {
  return (
    <p>
      A Rebrota libera no estágio {panel.stageNeeded}, que rende pelo menos{' '}
      {formatRoots(panel.minRoots)}. A comitiva já liberou o estágio {panel.maxStage}.
    </p>
  );
}

// Chave da compra automática de melhorias ("Mão ligeira")
function AutoBuySwitch({ isOn }: { isOn: boolean }) {
  const setAutoBuy = useGameStore((store) => store.setAutoBuy);

  return (
    <label className={`${SECTION_CLASS} flex items-center gap-2`}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-tinta"
        checked={isOn}
        onChange={(event) => setAutoBuy(event.target.checked)}
      />
      <span>Comprar melhorias sozinho, sempre a mais barata primeiro</span>
    </label>
  );
}


// =============================================================================
// =============================================================================
// G A L H O S   E   N Ó S

// Um galho do juazeiro, com os nós dele
function BranchSection({ branch }: { branch: JuazeiroBranchView }) {
  return (
    <section>
      <h3 className="font-display text-base leading-tight">{branch.name}</h3>
      <p className="mb-1 text-xs text-tinta/70">{branch.description}</p>
      <ul className="space-y-2">
        {branch.nodes.map((node) => (
          <NodeRow key={node.id} node={node} />
        ))}
      </ul>
    </section>
  );
}

// Um nó: nome, nível, efeito e o botão de fincar Raízes nele
function NodeRow({ node }: { node: JuazeiroNodeView }) {
  const buyJuazeiroNode = useGameStore((store) => store.buyJuazeiroNode);
  const label = node.isMaxed ? 'Completo' : `Fincar: ${formatRoots(node.cost)}`;

  return (
    <li className={SECTION_CLASS}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold">{node.name}</p>
        <p className="shrink-0 text-xs">
          Nível {node.level} de {node.maxLevel}
        </p>
      </div>
      <p className="text-xs">{node.description}</p>
      <Button
        size="small"
        className="mt-1"
        disabled={!node.canBuy}
        onClick={() => buyJuazeiroNode(node.id)}
      >
        {label}
      </Button>
    </li>
  );
}
