/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/header/ResourceBar.tsx
 * O que faz: mostra os recursos de quem joga: Patacas, Raízes e Oferendas.
 * Só formata os números que recebe do seletor.
 */

import { Coins, Sprout } from 'lucide-react';

import { selectHeaderView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatNumber } from '../../utils/format';

// =============================================================================
// =============================================================================
// R E C U R S O S

const ICON_SIZE = 18;

// Patacas em destaque, Raízes quando houver e uma etiqueta por Oferenda
export function ResourceBar() {
  const header = useGameStore(selectHeaderView);

  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <div className="flex items-center gap-1.5" title="Patacas">
        <dt className="flex items-center gap-1.5">
          <Coins size={ICON_SIZE} aria-hidden="true" />
          <span className="sr-only">Patacas</span>
        </dt>
        <dd className="font-display text-xl leading-none">{formatNumber(header.gold)}</dd>
      </div>

      {header.roots > 0 && (
        <div className="flex items-center gap-1.5" title="Raízes">
          <dt className="flex items-center gap-1.5">
            <Sprout size={ICON_SIZE} aria-hidden="true" />
            <span className="sr-only">Raízes</span>
          </dt>
          <dd className="font-display text-xl leading-none">{formatNumber(header.roots)}</dd>
        </div>
      )}

      {header.items.map((item) => (
        <div key={item.id} className="flex items-baseline gap-1.5">
          <dt className="text-tinta/70">{item.name}</dt>
          <dd className="font-bold">{formatNumber(item.amount)}</dd>
        </div>
      ))}
    </dl>
  );
}
