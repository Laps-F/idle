/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/arena/EventLog.tsx
 * O que faz: o registro compacto do que acabou de acontecer na arena:
 * derrotas, chefes, Oferendas, Rastros, níveis e amuletos. Golpes ficam de fora, porque
 * já aparecem como números na capa.
 *
 * Mapa:
 *   1. Registro
 *   2. Texto e ícone de cada linha
 */

import {
  Crown,
  Footprints,
  Gem,
  Hammer,
  Hourglass,
  Skull,
  Sparkles,
  Swords,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { appendToLog } from '../../store/eventViews';
import type { LogEntry, LogEntryKind } from '../../store/eventViews';
import { formatCount, formatNumber } from '../../utils/format';
import { useCombatFeed } from '../hooks/useCombatFeed';
import { RARITY_LABELS } from '../theme';

// =============================================================================
// =============================================================================
// R E G I S T R O

// Quantas linhas o registro guarda. As mais antigas saem.
const MAX_LOG_ENTRIES = 6;
const ICON_SIZE = 15;

const EMPTY_LOG: readonly LogEntry[] = [];

// Lista das últimas linhas, com a mais nova em cima
export function EventLog() {
  const [log, setLog] = useState(EMPTY_LOG);

  useCombatFeed((feed) => {
    if (feed.entries.length > 0) {
      setLog((current) => appendToLog(current, feed.entries, MAX_LOG_ENTRIES));
    }
  });

  const newestFirst = [...log].reverse();

  return (
    <div className="min-h-24 flex-1 border-2 border-tinta bg-jornal p-3">
      <h3 className="mb-1 text-sm font-bold">O que aconteceu</h3>
      {newestFirst.length === 0 ? (
        <p className="text-sm text-tinta/70">As novidades do combate aparecem aqui.</p>
      ) : (
        <ol className="space-y-0.5 text-sm" aria-live="off">
          {newestFirst.map((entry, index) => (
            <LogLine key={log.length - index} entry={entry} />
          ))}
        </ol>
      )}
    </div>
  );
}

// Uma linha do registro: ícone do tipo e o texto
function LogLine({ entry }: { entry: LogEntry }) {
  const Icon = LOG_ICONS[entry.kind];

  return (
    <li className="flex items-center gap-1.5">
      <Icon size={ICON_SIZE} aria-hidden="true" className="shrink-0" />
      <span>{describeEntry(entry)}</span>
    </li>
  );
}


// =============================================================================
// =============================================================================
// T E X T O   E   Í C O N E   D E   C A D A   L I N H A

const LOG_ICONS: Record<LogEntryKind, LucideIcon> = {
  kills: Swords,
  bossDefeated: Crown,
  bossAppeared: Skull,
  bossFailed: Hourglass,
  stageAdvanced: TrendingUp,
  drop: Sparkles,
  trail: Footprints,
  levelUp: TrendingUp,
  amuletFound: Gem,
  amuletSalvaged: Hammer,
};

// Frase de uma linha do registro
function describeEntry(entry: LogEntry): string {
  const amount = formatNumber(entry.amount);
  const shavings = formatCount(entry.amount, 'Cavaco', 'Cavacos');

  switch (entry.kind) {
    case 'kills':
      return entry.count === 1
        ? `${entry.name} caiu: +${amount} Patacas`
        : `${entry.count} visagens caíram: +${amount} Patacas`;
    case 'bossDefeated':
      return `${entry.name} foi vencido: +${amount} Patacas`;
    case 'bossAppeared':
      return `${entry.name} entrou em campo`;
    case 'bossFailed':
      return `O tempo acabou e ${entry.name} escapou`;
    case 'stageAdvanced':
      return `A comitiva chegou ao estágio ${amount}`;
    case 'drop':
      return `Oferenda encontrada: ${entry.name} +${amount}`;
    case 'trail':
      return `Rastro encontrado: ${entry.name} +${amount}`;
    case 'levelUp':
      return `${entry.name} subiu para o nível ${amount}`;
    case 'amuletFound':
      return `Amuleto encontrado: ${entry.name}${describeRarity(entry)}`;
    case 'amuletSalvaged':
      return `${entry.name}${describeRarity(entry)} virou ${shavings}`;
  }
}

// Raridade entre parênteses, para as linhas de amuleto: " (raro)"
function describeRarity(entry: LogEntry): string {
  return entry.rarity === undefined ? '' : ` (${RARITY_LABELS[entry.rarity].toLowerCase()})`;
}
