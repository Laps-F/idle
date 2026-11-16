/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/progress/AmuletsPanel.tsx
 * O que faz: a aba de amuletos. Em cima, os Cavacos, a lotação da mochila e o
 * desmanche automático. No meio, quem veste o quê. Embaixo, a mochila, onde
 * cada amuleto pode ser vestido, entalhado ou desmanchado.
 *
 * Componente burro: bônus, custo de entalhe, valor de desmanche e "dá para
 * entalhar" chegam prontos do seletor selectAmuletPanel. Aqui só se formata
 * e se chamam as ações da store. Nada desta aba muda a cada tick, então ela
 * só redesenha quando um amuleto cai ou uma ação é feita.
 *
 * Mapa:
 *   1. Painel
 *   2. Resumo e desmanche automático
 *   3. Quem veste o quê
 *   4. Mochila
 *   5. Peças de um amuleto
 */

import type { ChangeEvent, ReactNode } from 'react';

import { selectAmuletPanel } from '../../store/selectors';
import type { AmuletPanelView, AmuletSlotView, AmuletView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatCount, formatSignedPercent } from '../../utils/format';
import {
  AUTO_SALVAGE_LABELS,
  AUTO_SALVAGE_OFF_LABEL,
  BONUS_LABELS,
  RARITY_LABELS,
  RARITY_STAMP_CLASSES,
} from '../theme';
import { Button } from '../ui/Button';
import { Figure } from '../ui/Figure';

// =============================================================================
// =============================================================================
// P A I N E L

// Valor do seletor de desmanche automático quando ele está desligado
const AUTO_SALVAGE_OFF_VALUE = '';

const SECTION_TITLE_CLASS = 'mb-1 text-sm font-bold';

// "1 Cavaco", "12 Cavacos"
function formatShavings(amount: number): string {
  return formatCount(amount, 'Cavaco', 'Cavacos');
}

// Resumo, quem veste e mochila
export function AmuletsPanel() {
  const panel = useGameStore(selectAmuletPanel);
  const wearers = panel.slots.filter((slot) => slot.isInParty);

  return (
    <div className="space-y-4 text-sm">
      <AmuletSummary panel={panel} />
      <WearerList slots={panel.slots} />
      <BagList bag={panel.bag} commonsInBag={panel.commonsInBag} wearers={wearers} />
    </div>
  );
}


// =============================================================================
// =============================================================================
// R E S U M O   E   D E S M A N C H E   A U T O M Á T I C O

// Cavacos, lotação da mochila e até que raridade o desmanche automático leva
function AmuletSummary({ panel }: { panel: AmuletPanelView }) {
  const setAutoSalvage = useGameStore((store) => store.setAutoSalvage);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const chosen = panel.rarities.find((rarity) => rarity === event.target.value);
    setAutoSalvage(chosen ?? null);
  };

  return (
    <div>
      <p>
        <span className="font-bold">{formatShavings(panel.shavings)}</span>. Mochila com{' '}
        {panel.bagCount} de {panel.bagSize} amuletos.
      </p>
      <label className="mt-2 block">
        <span className="font-bold">Desmanchar sozinho o que cair</span>
        <select
          className="mt-1 block w-full border-2 border-tinta bg-white px-2 py-1"
          value={panel.autoSalvage ?? AUTO_SALVAGE_OFF_VALUE}
          onChange={handleChange}
        >
          <option value={AUTO_SALVAGE_OFF_VALUE}>{AUTO_SALVAGE_OFF_LABEL}</option>
          {panel.rarities.map((rarity) => (
            <option key={rarity} value={rarity}>
              {AUTO_SALVAGE_LABELS[rarity]}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1 text-xs text-tinta/70">
        Com a mochila cheia, o que cair também vira Cavacos.
      </p>
    </div>
  );
}


// =============================================================================
// =============================================================================
// Q U E M   V E S T E   O   Q U Ê

// Uma linha por encantado do elenco, com o amuleto dele
function WearerList({ slots }: { slots: AmuletSlotView[] }) {
  return (
    <div>
      <h3 className={SECTION_TITLE_CLASS}>Quem veste</h3>
      {slots.length === 0 ? (
        <p className="text-tinta/70">Ninguém na comitiva ainda.</p>
      ) : (
        <ul className="space-y-2">
          {slots.map((slot) => (
            <WearerRow key={slot.encantadoId} slot={slot} />
          ))}
        </ul>
      )}
    </div>
  );
}

// Nome do encantado e o amuleto vestido, com os botões de entalhar e guardar
function WearerRow({ slot }: { slot: AmuletSlotView }) {
  const unequipAmulet = useGameStore((store) => store.unequipAmulet);
  const note = slot.isInParty ? '' : ' (fora da comitiva: o amuleto não está valendo)';

  return (
    <li className="border-2 border-tinta p-2">
      <p className="font-bold">
        {slot.encantadoName}
        <span className="font-normal text-tinta/70">{note}</span>
      </p>
      {slot.amulet === null ? (
        <p className="text-tinta/70">Sem amuleto.</p>
      ) : (
        <AmuletCard amulet={slot.amulet}>
          <CarveButton amulet={slot.amulet} />
          <Button size="small" onClick={() => unequipAmulet(slot.encantadoId)}>
            Guardar na mochila
          </Button>
        </AmuletCard>
      )}
    </li>
  );
}


// =============================================================================
// =============================================================================
// M O C H I L A

interface BagListProps {
  bag: AmuletView[];
  commonsInBag: number;
  wearers: AmuletSlotView[]; // encantados da comitiva, que podem vestir
}

// Amuletos guardados, do mais raro para o mais comum
function BagList({ bag, commonsInBag, wearers }: BagListProps) {
  const salvageBagUpTo = useGameStore((store) => store.salvageBagUpTo);

  return (
    <div>
      <h3 className={SECTION_TITLE_CLASS}>Mochila</h3>
      {bag.length === 0 ? (
        <p className="text-tinta/70">
          A mochila está vazia. Chefes vencidos costumam deixar um amuleto.
        </p>
      ) : (
        <ul className="space-y-2">
          {bag.map((amulet) => (
            <BagRow key={amulet.id} amulet={amulet} wearers={wearers} />
          ))}
        </ul>
      )}
      {commonsInBag > 0 && (
        <Button className="mt-2 w-full" onClick={() => salvageBagUpTo('comum')}>
          {commonsInBag === 1
            ? 'Desmanchar o comum da mochila'
            : `Desmanchar os ${commonsInBag} comuns da mochila`}
        </Button>
      )}
    </div>
  );
}

// Um amuleto da mochila, com os botões de vestir, entalhar e desmanchar
function BagRow({ amulet, wearers }: { amulet: AmuletView; wearers: AmuletSlotView[] }) {
  const equipAmulet = useGameStore((store) => store.equipAmulet);
  const salvageAmulet = useGameStore((store) => store.salvageAmulet);

  return (
    <li className="border-2 border-tinta p-2">
      <AmuletCard amulet={amulet}>
        {wearers.map((wearer) => (
          <Button
            key={wearer.encantadoId}
            variant="solid"
            size="small"
            onClick={() => equipAmulet(wearer.encantadoId, amulet.id)}
          >
            Vestir em {wearer.encantadoName}
          </Button>
        ))}
        <CarveButton amulet={amulet} />
        <Button size="small" onClick={() => salvageAmulet(amulet.id)}>
          Desmanchar: +{formatShavings(amulet.salvageValue)}
        </Button>
      </AmuletCard>
    </li>
  );
}


// =============================================================================
// =============================================================================
// P E Ç A S   D E   U M   A M U L E T O

// Figura, nome, raridade, nível de entalhe e bônus. Os botões entram como filhos.
function AmuletCard({ amulet, children }: { amulet: AmuletView; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Figure
          figureId={amulet.baseId}
          label={amulet.name}
          paper="var(--color-jornal)"
          className="h-10 w-10 shrink-0"
        />
        <div className="min-w-0">
          <p className="font-bold leading-tight" title={amulet.description}>
            {amulet.name}
          </p>
          <p className="text-xs">
            <span className={`px-1 font-bold ${RARITY_STAMP_CLASSES[amulet.rarity]}`}>
              {RARITY_LABELS[amulet.rarity]}
            </span>{' '}
            Entalhe {amulet.level} de {amulet.maxLevel}
          </p>
        </div>
      </div>
      <ul className="mt-1 text-xs">
        {amulet.bonuses.map((bonus, index) => (
          <li key={bonus.stat} className={index === 0 ? 'font-bold' : ''}>
            {formatSignedPercent(bonus.value)} {BONUS_LABELS[bonus.stat]}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// Botão de entalhe, com o custo. Apagado sem Cavacos ou no nível máximo.
function CarveButton({ amulet }: { amulet: AmuletView }) {
  const carveAmulet = useGameStore((store) => store.carveAmulet);
  const label = amulet.isMaxed
    ? 'Entalhe no máximo'
    : `Entalhar por ${formatShavings(amulet.carveCost)}`;

  return (
    <Button size="small" disabled={!amulet.canCarve} onClick={() => carveAmulet(amulet.id)}>
      {label}
    </Button>
  );
}
