/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/party/AlmanacPanel.tsx
 * O que faz: a aba do Almanaque. Mostra os encantados que entram por pacto,
 * com a quadra de cordel de cada um e a lista do que falta: Rastros,
 * Oferendas e, às vezes, a hora certa. Quando tudo está pronto, o botão de
 * fechar o pacto acende.
 *
 * Mapa:
 *   1. Painel
 *   2. Folha de um encantado
 *   3. Lista do que o pacto pede
 */

import { Check, CircleDashed } from 'lucide-react';

import { selectPacts } from '../../store/selectors';
import type { PactView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { DAY_PHASE_LABELS, MOON_PHASE_LABELS, ORIGIN_LABELS, RARITY_LABELS } from '../theme';
import { Button } from '../ui/Button';
import { Figure } from '../ui/Figure';

// =============================================================================
// =============================================================================
// P A I N E L

const ICON_SIZE = 14;

interface Requirement {
  label: string;
  isMet: boolean;
}

// Uma folha por encantado de pacto
export function AlmanacPanel() {
  const pacts = useGameStore(selectPacts);

  return (
    <ul className="space-y-4">
      {pacts.map((pact) => (
        <PactSheet key={pact.id} pact={pact} />
      ))}
    </ul>
  );
}


// =============================================================================
// =============================================================================
// F O L H A   D E   U M   E N C A N T A D O

// Figura, quadra de cordel e, para quem ainda não está no elenco, o que falta
function PactSheet({ pact }: { pact: PactView }) {
  const sealPact = useGameStore((store) => store.sealPact);

  return (
    <li className="border-2 border-tinta p-2">
      <div className="flex items-center gap-2">
        <Figure
          figureId={pact.id}
          label={pact.name}
          paper="var(--color-jornal)"
          className={`h-14 w-14 shrink-0 ${pact.isOwned ? '' : 'opacity-60'}`}
        />
        <div>
          <p className="font-display text-lg leading-tight">{pact.name}</p>
          <p className="text-xs">
            {ORIGIN_LABELS[pact.origin]}, {RARITY_LABELS[pact.rarity].toLowerCase()}
          </p>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-line text-xs italic leading-snug">{pact.verse}</p>

      {pact.isOwned ? (
        <p className="mt-2 text-xs font-bold">Pacto fechado. Já está no seu elenco.</p>
      ) : (
        <>
          <RequirementList requirements={getRequirements(pact)} />
          <Button
            variant="solid"
            className="mt-2 w-full"
            disabled={!pact.canSeal}
            onClick={() => sealPact(pact.id)}
          >
            Fechar pacto
          </Button>
        </>
      )}
    </li>
  );
}


// =============================================================================
// =============================================================================
// L I S T A   D O   Q U E   O   P A C T O   P E D E

// Rastros, cada Oferenda e a hora pedida, cada um com a marca de cumprido ou não
function getRequirements(pact: PactView): Requirement[] {
  const requirements: Requirement[] = [
    {
      label: `Rastros: ${pact.trailsOwned} de ${pact.trailsNeeded}`,
      isMet: pact.trailsOwned >= pact.trailsNeeded,
    },
    ...pact.offerings.map((offering) => ({
      label: `${offering.name}: ${offering.owned} de ${offering.needed}`,
      isMet: offering.owned >= offering.needed,
    })),
  ];

  if (pact.requiredDayPhase !== null) {
    const phase = DAY_PHASE_LABELS[pact.requiredDayPhase].toLowerCase();
    requirements.push({ label: `Só fecha de ${phase}`, isMet: pact.isClockRight });
  }
  if (pact.requiredMoonPhase !== null) {
    const moon = MOON_PHASE_LABELS[pact.requiredMoonPhase];
    requirements.push({ label: `Só fecha na ${moon}`, isMet: pact.isClockRight });
  }

  return requirements;
}

// Lista com um ícone de cumprido ou pendente em cada linha
function RequirementList({ requirements }: { requirements: Requirement[] }) {
  return (
    <ul className="mt-2 space-y-0.5 text-xs">
      {requirements.map((requirement) => {
        const Icon = requirement.isMet ? Check : CircleDashed;

        return (
          <li
            key={requirement.label}
            className={`flex items-center gap-1.5 ${requirement.isMet ? 'font-bold' : ''}`}
          >
            <Icon size={ICON_SIZE} aria-hidden="true" className="shrink-0" />
            {requirement.label}
            <span className="sr-only">{requirement.isMet ? '(pronto)' : '(falta)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
