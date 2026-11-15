/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/eventViews.ts
 * O que faz: traduz os eventos de combate de um tick para o que a tela
 * mostra: os golpes (para os números que sobem) e as linhas do registro.
 * Resolve os nomes aqui, para o componente não precisar consultar os dados.
 *
 * Mapa:
 *   1. Tipos
 *   2. Tradução dos eventos
 *   3. Registro compacto
 */

import { getEncantado, getEnemy, getItem } from '../domain/catalog';
import type { CombatEvent } from '../domain/types';

// =============================================================================
// =============================================================================
// T I P O S

export interface HitView {
  damage: number;
  isCrit: boolean;
}

export type LogEntryKind =
  | 'kills' // visagens derrotadas. "amount" é a soma das Patacas e "count" quantas foram.
  | 'bossDefeated' // "name" é o chefe e "amount" as Patacas
  | 'bossAppeared'
  | 'bossFailed'
  | 'stageAdvanced' // "amount" é o estágio novo
  | 'drop' // "name" é a Oferenda e "amount" a quantidade
  | 'trail' // "name" é o encantado e "amount" quantos Rastros
  | 'levelUp'; // "name" é o encantado e "amount" o nível novo

export interface LogEntry {
  kind: LogEntryKind;
  name: string;
  amount: number;
  count: number;
}

// O que um tick deixou para a tela mostrar
export interface CombatFeed {
  hits: HitView[];
  goldGained: number;
  entries: LogEntry[];
}


// =============================================================================
// =============================================================================
// T R A D U Ç Ã O   D O S   E V E N T O S

// Eventos de um tick -> golpes, Patacas ganhas e linhas do registro
export function toCombatFeed(events: readonly CombatEvent[]): CombatFeed {
  const hits: HitView[] = [];
  const entries: LogEntry[] = [];
  let goldGained = 0;

  for (const event of events) {
    if (event.type === 'hit') {
      hits.push({ damage: event.damage, isCrit: event.isCrit });
    } else {
      entries.push(toLogEntry(event));
    }
    if (event.type === 'kill') {
      goldGained += event.gold;
    }
  }

  return { hits, goldGained, entries };
}

// Um evento que não é golpe -> uma linha do registro
function toLogEntry(event: Exclude<CombatEvent, { type: 'hit' }>): LogEntry {
  switch (event.type) {
    case 'kill': {
      const kind = event.isBoss ? 'bossDefeated' : 'kills';
      return { kind, name: getEnemy(event.enemyId).name, amount: event.gold, count: 1 };
    }
    case 'drop':
      return { kind: 'drop', name: getItem(event.itemId).name, amount: event.amount, count: 1 };
    case 'trail':
      return { kind: 'trail', name: getEncantado(event.encantadoId).name, amount: 1, count: 1 };
    case 'levelUp': {
      const name = getEncantado(event.encantadoId).name;
      return { kind: 'levelUp', name, amount: event.level, count: 1 };
    }
    case 'bossAppeared':
      return { kind: 'bossAppeared', name: getEnemy(event.enemyId).name, amount: 0, count: 1 };
    case 'bossFailed':
      return { kind: 'bossFailed', name: getEnemy(event.enemyId).name, amount: 0, count: 1 };
    case 'stageAdvanced':
      return { kind: 'stageAdvanced', name: '', amount: event.stage, count: 1 };
  }
}


// =============================================================================
// =============================================================================
// R E G I S T R O   C O M P A C T O

/**
 * Junta linhas novas ao registro, mantendo-o curto.
 *
 * Linhas repetidas em sequência são somadas em uma só: várias visagens
 * derrotadas viram "3 visagens derrotadas", e o mesmo item ou Rastro soma a
 * quantidade. Assim uma Oferenda rara não some da tela empurrada por derrotas comuns.
 *
 * @param log Registro atual, com a linha mais nova no fim. Não é alterado.
 * @param entries Linhas novas, na ordem em que aconteceram.
 * @param maxEntries Quantas linhas o registro guarda.
 * @returns Registro novo, com no máximo "maxEntries" linhas. As mais antigas saem.
 *
 * Caso de borda: sem linhas novas, devolve o mesmo registro recebido.
 */
export function appendToLog(
  log: readonly LogEntry[],
  entries: readonly LogEntry[],
  maxEntries: number,
): readonly LogEntry[] {
  if (entries.length === 0) {
    return log;
  }

  const merged = [...log];

  for (const entry of entries) {
    const last = merged[merged.length - 1];

    if (last !== undefined && canMerge(last, entry)) {
      merged[merged.length - 1] = mergeEntries(last, entry);
    } else {
      merged.push(entry);
    }
  }

  return merged.slice(-maxEntries);
}

// Só somam: derrotas comuns entre si, e o mesmo item ou o mesmo Rastro em sequência
function canMerge(last: LogEntry, next: LogEntry): boolean {
  const isSummable = next.kind === 'kills' || next.kind === 'drop' || next.kind === 'trail';
  const isSameSubject = next.kind === 'kills' || last.name === next.name;
  return isSummable && last.kind === next.kind && isSameSubject;
}

// Soma as quantidades de duas linhas do mesmo tipo
function mergeEntries(last: LogEntry, next: LogEntry): LogEntry {
  return { ...last, amount: last.amount + next.amount, count: last.count + next.count };
}
