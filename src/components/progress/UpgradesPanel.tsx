/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/progress/UpgradesPanel.tsx
 * O que faz: a aba de melhorias. Lista cada melhoria com o nível, o efeito e
 * o custo do próximo nível. O custo e o "dá para comprar" chegam calculados
 * pelo domínio, por meio do seletor. Aqui o botão só reflete esse estado.
 */

import { selectUpgradeViews } from '../../store/selectors';
import type { UpgradeView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatNumber } from '../../utils/format';
import { Button } from '../ui/Button';

// =============================================================================
// =============================================================================
// M E L H O R I A S

// Lista de melhorias. Só redesenha quando um nível muda ou um botão liga ou desliga.
export function UpgradesPanel() {
  const upgrades = useGameStore(selectUpgradeViews);

  return (
    <ul className="space-y-3">
      {upgrades.map((upgrade) => (
        <UpgradeRow key={upgrade.id} upgrade={upgrade} />
      ))}
    </ul>
  );
}

// Nome, nível, efeito e o botão de compra com o custo
function UpgradeRow({ upgrade }: { upgrade: UpgradeView }) {
  const buyUpgrade = useGameStore((store) => store.buyUpgrade);
  const buttonText = upgrade.isMaxed
    ? 'Nível máximo'
    : `Comprar por ${formatNumber(upgrade.cost)} Patacas`;

  return (
    <li className="border-2 border-tinta p-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg leading-tight">{upgrade.name}</p>
        <p className="shrink-0 text-xs font-bold">Nível {upgrade.level}</p>
      </div>
      <p className="mt-0.5 text-xs">{upgrade.description}</p>
      <Button
        variant="solid"
        className="mt-2 w-full"
        disabled={!upgrade.canBuy}
        onClick={() => buyUpgrade(upgrade.id)}
      >
        {buttonText}
      </Button>
    </li>
  );
}
