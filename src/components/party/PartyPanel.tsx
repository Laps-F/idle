/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/party/PartyPanel.tsx
 * O que faz: a aba da comitiva. Mostra cada encantado do elenco (nível, XP,
 * dano, ritmo e o dom), deixa colocar e tirar da comitiva e lista as sinergias
 * de origem. Os valores de dano e ritmo chegam prontos do seletor.
 *
 * Mapa:
 *   1. Painel
 *   2. Cartão de um encantado
 *   3. Sinergias
 */

import { selectPartyCards, selectSynergies } from '../../store/selectors';
import type { PartyCardView, SynergyView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatDecimal, formatNumber } from '../../utils/format';
import { ORIGIN_LABELS, RARITY_LABELS } from '../theme';
import { Button } from '../ui/Button';
import { Figure } from '../ui/Figure';
import { Meter } from '../ui/Meter';

// =============================================================================
// =============================================================================
// P A I N E L

// Elenco em cartões e, abaixo, as sinergias
export function PartyPanel() {
  const cards = useGameStore(selectPartyCards);
  const synergies = useGameStore(selectSynergies);

  if (cards.length === 0) {
    return (
      <p className="text-sm text-tinta/70">Escolha quem começa com você para montar a comitiva.</p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {cards.map((card) => (
          <PartyCard key={card.id} card={card} />
        ))}
      </ul>
      <SynergyList synergies={synergies} />
    </div>
  );
}


// =============================================================================
// =============================================================================
// C A R T Ã O   D E   U M   E N C A N T A D O

// Quem está na comitiva fica em papel claro. Quem está fora, em papel mais escuro.
const ACTIVE_CARD_CLASS = 'border-2 border-tinta bg-jornal p-2';
const BENCH_CARD_CLASS = 'border-2 border-tinta bg-jornal-escuro p-2';

// Figura, nome, nível, XP, dano, dom e o botão de entrar ou sair da comitiva
function PartyCard({ card }: { card: PartyCardView }) {
  const togglePartyMember = useGameStore((store) => store.togglePartyMember);
  const xpText = `${formatNumber(card.xp)} de ${formatNumber(card.xpToNextLevel)} de XP`;

  return (
    <li className={card.isInParty ? ACTIVE_CARD_CLASS : BENCH_CARD_CLASS}>
      <div className="flex items-center gap-2">
        <Figure
          figureId={card.id}
          label={card.name}
          paper={card.isInParty ? 'var(--color-jornal)' : 'var(--color-jornal-escuro)'}
          className="h-14 w-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight">{card.name}</p>
          <p className="text-xs">
            {ORIGIN_LABELS[card.origin]}, {RARITY_LABELS[card.rarity].toLowerCase()}, nível{' '}
            {card.level}
          </p>
        </div>
      </div>

      <Meter fraction={card.xpFraction} label={`XP de ${card.name}`} className="mt-2 h-2" />
      <p className="mt-1 text-xs">{xpText}</p>
      <p className="text-xs">
        {formatDecimal(card.damagePerHit)} de dano a cada {formatDecimal(card.attackInterval)} s
      </p>
      {card.gift !== null && (
        <p className={card.isInParty ? 'text-xs font-bold' : 'text-xs'}>
          Dom: {card.gift.name}. {card.gift.description}{' '}
          {card.isInParty ? 'Valendo agora.' : 'Vale quando está na comitiva.'}
        </p>
      )}

      <Button
        className="mt-2 w-full"
        disabled={!card.canToggle}
        onClick={() => togglePartyMember(card.id)}
      >
        {card.isInParty ? 'Tirar da comitiva' : 'Chamar para a comitiva'}
      </Button>
    </li>
  );
}


// =============================================================================
// =============================================================================
// S I N E R G I A S

// Bônus de origem: acende quando a comitiva tem encantados suficientes da mesma origem
function SynergyList({ synergies }: { synergies: SynergyView[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-bold">Sinergias de origem</h3>
      <ul className="space-y-1 text-xs">
        {synergies.map((synergy) => (
          <li
            key={synergy.origin}
            className={synergy.isActive ? 'font-bold' : 'text-tinta/70'}
          >
            {synergy.name} ({ORIGIN_LABELS[synergy.origin]} {synergy.membersInParty} de{' '}
            {synergy.membersNeeded}): {synergy.description}
            {synergy.isActive ? ' Valendo agora.' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
