/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/expedition/ExpeditionsPanel.tsx
 * O que faz: a aba "Expedições" da clareira. Explica como a expedição
 * funciona, mostra quem sairia e com quanta vida, e lista os mapas com o
 * nível, as visagens, de quem são as pegadas que podem surgir e o botão de
 * partir. Antes de partir dá para escolher um preparo pago com Oferendas. Só
 * formata o que recebe do seletor. A escolha do preparo é estado só da tela:
 * quem confere e paga é a store (startExpedition).
 *
 * Mapa:
 *   1. Aba
 *   2. Quem sai
 *   3. Preparos
 *   4. Textos
 */

import { useState } from 'react';
import { selectExpeditionList } from '../../store/expeditionSelectors';
import type {
  ExpeditionPreparationView,
  PartyLeaderOptionView,
} from '../../store/expeditionSelectors';
import type { NamedAmount } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatDuration, formatNumber, formatPercent } from '../../utils/format';
import { Button } from '../ui/Button';

// =============================================================================
// =============================================================================
// A B A

const CARD_CLASS = 'space-y-1 border-2 border-tinta bg-jornal p-3';

// Lista de mapas e o botão de partir
export function ExpeditionsPanel() {
  const list = useGameStore(selectExpeditionList);
  const startExpedition = useGameStore((store) => store.startExpedition);
  const setPartyLeader = useGameStore((store) => store.setPartyLeader);
  const canStart = list.leaderName !== null;
  // Escolha só da tela, até partir. Preparo que deixou de caber no inventário vira "nenhum".
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = list.preparations.find((item) => item.id === chosenId && item.canAfford) ?? null;

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Saia da clareira com o primeiro encantado da comitiva. As visagens perseguem e batem, e as
        ondas ficam mais fortes com o tempo. Volte pela passagem quando quiser: a bolsa vem
        inteira, mesmo se você cair. Quem aguenta {formatDuration(list.durationSeconds)} ganha{' '}
        {formatPercent(list.completionBonus)} a mais.
      </p>
      <p className="text-sm">
        Enquanto a comitiva está fora, a clareira para. Na volta, a bolsa rende pelo menos as
        Patacas e o XP que a clareira teria rendido no mesmo tempo, mesmo se você cair.
      </p>
      <p className="text-sm">
        O nível das visagens acompanha a força de quem sai. Quanto mais forte a comitiva fica na
        clareira, mais fortes são as visagens e mais a bolsa rende.
      </p>
      <p className="text-sm font-bold">
        {canStart
          ? `Quem sai: ${list.leaderName}, com ${formatNumber(list.leaderMaxHp)} de vida.`
          : 'Escolha um encantado para começar antes de sair.'}
      </p>
      <LeaderPicker members={list.partyMembers} onChoose={setPartyLeader} />
      <PreparationPicker
        preparations={list.preparations}
        chosenId={chosen?.id ?? null}
        onChoose={setChosenId}
      />
      <ul className="space-y-2">
        {list.options.map((option) => (
          <li key={option.id} className={CARD_CLASS}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg leading-none">{option.name}</h3>
              <span className="text-xs">nível {option.level}</span>
            </div>
            <p className="text-xs">{option.enemyNames.join(', ')}</p>
            <p className="text-xs">{describeFootprints(option.footprints)}</p>
            <Button
              size="small"
              variant="solid"
              disabled={!canStart}
              onClick={() => {
                if (startExpedition(option.id, chosen?.id ?? null)) {
                  setChosenId(null);
                }
              }}
            >
              Partir para {option.name}
              {chosen === null ? '' : ` com ${chosen.name}`}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}


// =============================================================================
// =============================================================================
// Q U E M   S A I

interface LeaderPickerProps {
  members: readonly PartyLeaderOptionView[];
  onChoose: (id: string) => void;
}

// Um botão por encantado da comitiva. O marcado é quem sai. Com um só, não aparece.
function LeaderPicker({ members, onChoose }: LeaderPickerProps) {
  if (members.length < 2) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quem sai primeiro">
      <span className="text-xs">Trocar quem sai:</span>
      {members.map((member) => (
        <Button
          key={member.id}
          size="small"
          variant={member.isLeader ? 'solid' : 'outline'}
          aria-pressed={member.isLeader}
          onClick={() => onChoose(member.id)}
        >
          {member.name}
        </Button>
      ))}
    </div>
  );
}


// =============================================================================
// =============================================================================
// P R E P A R O S

interface PreparationPickerProps {
  preparations: readonly ExpeditionPreparationView[];
  chosenId: string | null;
  onChoose: (id: string | null) => void;
}

// Um preparo por expedição, opcional. Clicar no escolhido desfaz a escolha.
function PreparationPicker({ preparations, chosenId, onChoose }: PreparationPickerProps) {
  return (
    <section className="space-y-2" aria-label="Preparo antes de partir">
      <h3 className="font-display text-lg leading-none">Preparo (opcional)</h3>
      <p className="text-xs">
        Gaste Oferendas para mudar a próxima expedição. Um preparo por vez, pago ao partir.
      </p>
      <ul className="space-y-2">
        {preparations.map((preparation) => {
          const isChosen = preparation.id === chosenId;
          return (
            <li key={preparation.id} className={CARD_CLASS}>
              <Button
                size="small"
                variant={isChosen ? 'solid' : 'outline'}
                disabled={!preparation.canAfford}
                aria-pressed={isChosen}
                onClick={() => onChoose(isChosen ? null : preparation.id)}
              >
                {isChosen ? `${preparation.name} (escolhido)` : preparation.name}
              </Button>
              <p className="text-xs">{preparation.description}</p>
              <p className="text-xs">{describeCost(preparation)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}


// =============================================================================
// =============================================================================
// T E X T O S

// "Custa 3 Mel silvestre (você tem 5)"
function describeCost(preparation: ExpeditionPreparationView): string {
  const parts = preparation.cost.map((item, index) => {
    const have = preparation.have[index]?.amount ?? 0;
    return `${formatNumber(item.amount)} ${item.name} (você tem ${formatNumber(have)})`;
  });
  return `Custa ${parts.join(' e ')}.`;
}

// "Pegadas: Caipora (faltam 3)", ou o aviso de que ninguém precisa de Rastro agora
function describeFootprints(footprints: readonly NamedAmount[]): string {
  if (footprints.length === 0) {
    return 'Pegadas: nenhum encantado precisa de Rastro agora.';
  }

  const names = footprints.map(({ name, amount }) => `${name} (faltam ${formatNumber(amount)})`);
  return `Pegadas: ${names.join(', ')}.`;
}
