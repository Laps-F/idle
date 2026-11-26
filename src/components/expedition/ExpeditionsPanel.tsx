/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/expedition/ExpeditionsPanel.tsx
 * O que faz: a aba "Expedições" da clareira. Explica como a expedição
 * funciona, mostra quem sairia e com quanta vida, e lista os mapas com o
 * nível, as visagens, de quem são as pegadas que podem surgir e o botão de
 * partir. Só formata o que recebe do seletor.
 *
 * Mapa:
 *   1. Aba
 *   2. Textos
 */

import { selectExpeditionList } from '../../store/expeditionSelectors';
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
  const canStart = list.leaderName !== null;

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Saia da clareira com o primeiro encantado da comitiva. As visagens perseguem e batem, e as
        ondas ficam mais fortes com o tempo. Volte pela passagem quando quiser: a bolsa vem
        inteira, mesmo se você cair. Quem aguenta {formatDuration(list.durationSeconds)} ganha{' '}
        {formatPercent(list.completionBonus)} a mais. A clareira continua rendendo enquanto isso.
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
              onClick={() => startExpedition(option.id)}
            >
              Partir para {option.name}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}


// =============================================================================
// =============================================================================
// T E X T O S

// "Pegadas: Caipora (faltam 3)", ou o aviso de que ninguém precisa de Rastro agora
function describeFootprints(footprints: readonly NamedAmount[]): string {
  if (footprints.length === 0) {
    return 'Pegadas: nenhum encantado precisa de Rastro agora.';
  }

  const names = footprints.map(({ name, amount }) => `${name} (faltam ${formatNumber(amount)})`);
  return `Pegadas: ${names.join(', ')}.`;
}
