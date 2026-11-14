/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/saveManager.ts
 * O que faz: cuida de tudo que envolve gravar e ler o jogo.
 *   - grava no localStorage sem travar o jogo (no máximo uma vez a cada 5 s);
 *   - transforma o salvamento em código de exportação e de volta;
 *   - atualiza salvamentos de versões antigas;
 *   - confere e conserta um salvamento antes de usar.
 *
 * Mapa:
 *   1. Constantes e tipos
 *   2. Gravação no localStorage
 *   3. Exportação e importação
 *   4. Migração entre versões
 *   5. Conferência do salvamento
 *   6. Ferramentas de conferência
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware';

import { BALANCE } from '../data/balance';
import { getUpgrade, getZoneForStage, hasEncantado, hasItem, hasUpgrade } from '../data';
import { createInitialState } from '../engine/state';
import type { CombatState, GameState, GameStats, OwnedEncantado } from '../types/game';
import { decodeBase64, encodeBase64 } from '../utils/base64';
import { isRecord } from '../utils/object';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

export const SAVE_STORAGE_KEY = 'encantados-save';

// Um salvamento ilegível é guardado nesta chave em vez de ser apagado
const CORRUPTED_BACKUP_SUFFIX = '-corrompido';

// Marca que identifica um código de exportação deste jogo
const SAVE_SIGNATURE = 'encantados';

const IMPORT_ERRORS = {
  unreadable: 'Não consegui ler esse código. Confira se ele foi copiado inteiro.',
  wrongGame: 'Esse código não é um salvamento do Encantados.',
  newerVersion:
    'Esse salvamento veio de uma versão mais nova do jogo. Atualize a página e tente de novo.',
} as const;

export interface ThrottledStorage {
  storage: PersistStorage<GameState>;
  flush: () => void; // grava agora o que estiver pendente
  disable: () => void; // para de gravar de vez e descarta o que estava pendente
}

export type DecodeResult = { ok: true; state: GameState } | { ok: false; error: string };

interface ExportedSave {
  game: string;
  version: number;
  exportedAt: number;
  state: unknown;
}

type Migration = (save: Record<string, unknown>) => Record<string, unknown>;


// =============================================================================
// =============================================================================
// G R A V A Ç Ã O   N O   L O C A L S T O R A G E

// Armazenamento para o persist do Zustand que junta as gravações.
// O tick muda o estado 10 vezes por segundo; gravar no disco nesse ritmo travaria o jogo.
export function createThrottledStorage(intervalMs: number): ThrottledStorage {
  let pending: { name: string; value: StorageValue<GameState> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isEnabled = true;

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending !== null) {
      writeToLocalStorage(pending.name, JSON.stringify(pending.value));
      pending = null;
    }
  };

  // Usado quando outra aba assume o jogo: esta não pode mais escrever por cima do salvamento
  const disable = (): void => {
    isEnabled = false;
    pending = null;
    flush();
  };

  const storage: PersistStorage<GameState> = {
    getItem: (name) => readSave(name),
    setItem: (name, value) => {
      if (isEnabled) {
        pending = { name, value };
        timer ??= setTimeout(flush, intervalMs);
      }
    },
    removeItem: (name) => {
      pending = null;
      getLocalStorage()?.removeItem(name);
    },
  };

  return { storage, flush, disable };
}

// Lê o salvamento. Se estiver ilegível, guarda uma cópia e devolve null (jogo novo).
function readSave(name: string): StorageValue<GameState> | null {
  const raw = getLocalStorage()?.getItem(name) ?? null;

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as StorageValue<GameState>;
  } catch (error) {
    console.warn('Salvamento ilegível. Uma cópia foi guardada e o jogo começa do zero.', error);
    writeToLocalStorage(name + CORRUPTED_BACKUP_SUFFIX, raw);
    return null;
  }
}

// Grava um texto no localStorage e avisa se o navegador recusar (disco cheio, modo privado)
export function writeToLocalStorage(name: string, text: string): void {
  try {
    getLocalStorage()?.setItem(name, text);
  } catch (error) {
    console.warn('Não foi possível gravar o jogo no navegador.', error);
  }
}

// O localStorage do navegador, ou null quando ele não existe ou está bloqueado
function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Alguns navegadores lançam erro só de acessar o localStorage com cookies bloqueados
    return null;
  }
}


// =============================================================================
// =============================================================================
// E X P O R T A Ç Ã O   E   I M P O R T A Ç Ã O

// Estado -> código de exportação (JSON em Base64)
export function encodeSave(state: GameState, now: number): string {
  const exported: ExportedSave = {
    game: SAVE_SIGNATURE,
    version: BALANCE.saveVersion,
    exportedAt: now,
    state,
  };
  return encodeBase64(JSON.stringify(exported));
}

// Código de exportação -> estado conferido, ou a mensagem do que deu errado
export function decodeSave(code: string, now: number): DecodeResult {
  const exported = parseExportedSave(code);

  if (exported === null) {
    return { ok: false, error: IMPORT_ERRORS.unreadable };
  }
  if (exported.game !== SAVE_SIGNATURE) {
    return { ok: false, error: IMPORT_ERRORS.wrongGame };
  }
  if (exported.version > BALANCE.saveVersion) {
    return { ok: false, error: IMPORT_ERRORS.newerVersion };
  }

  const state = sanitizeGameState(migrateSave(exported.state, exported.version), now);
  // Importar não rende progresso offline: o relógio recomeça agora
  state.lastSaveTimestamp = now;
  return { ok: true, state };
}

// Decodifica o código. Devolve null se não for Base64, JSON ou não tiver o formato esperado.
function parseExportedSave(code: string): ExportedSave | null {
  try {
    const parsed: unknown = JSON.parse(decodeBase64(code));
    const hasExpectedShape =
      isRecord(parsed) && typeof parsed.game === 'string' && typeof parsed.version === 'number';
    return hasExpectedShape ? (parsed as unknown as ExportedSave) : null;
  } catch {
    // Código cortado ou digitado errado: quem chama mostra a mensagem para a pessoa
    return null;
  }
}


// =============================================================================
// =============================================================================
// M I G R A Ç Ã O   E N T R E   V E R S Õ E S

// Uma função por versão de origem: MIGRATIONS[1] leva um salvamento da versão 1 para a 2.
// Está vazio porque a versão 1 é a primeira. Mudou o formato do GameState? Suba
// BALANCE.saveVersion e registre aqui como converter o formato antigo.
const MIGRATIONS: Record<number, Migration> = {};

// Aplica, em ordem, as migrações que faltam para o salvamento chegar à versão atual
export function migrateSave(save: unknown, fromVersion: number): unknown {
  let migrated = save;

  for (let version = fromVersion; version < BALANCE.saveVersion; version += 1) {
    const migration = MIGRATIONS[version];

    if (migration !== undefined && isRecord(migrated)) {
      migrated = migration(migrated);
    }
  }

  return migrated;
}


// =============================================================================
// =============================================================================
// C O N F E R Ê N C I A   D O   S A L V A M E N T O

// Monta um estado válido a partir de qualquer coisa lida do disco ou importada.
// Campo ausente ou estragado recebe o valor de um jogo novo.
export function sanitizeGameState(raw: unknown, now: number): GameState {
  const fresh = createInitialState(now);

  if (!isRecord(raw)) {
    return fresh;
  }

  const roster = sanitizeRoster(raw.roster);
  const stage = toInteger(raw.stage, 1, 1);
  const state: GameState = {
    version: BALANCE.saveVersion,
    gold: toNumber(raw.gold, 0, 0),
    stage,
    maxStage: Math.max(stage, toInteger(raw.maxStage, stage, 1)),
    killsInStage: Math.min(toInteger(raw.killsInStage, 0, 0), getZoneForStage(stage).killsToBoss),
    autoProgress: raw.autoProgress !== false,
    party: sanitizeParty(raw.party, roster),
    roster,
    trails: sanitizeCounters(raw.trails, hasEncantado),
    inventory: sanitizeCounters(raw.inventory, hasItem),
    upgrades: sanitizeUpgrades(raw.upgrades),
    roots: toInteger(raw.roots, 0, 0),
    combat: fresh.combat,
    lastSaveTimestamp: Math.min(toNumber(raw.lastSaveTimestamp, now, 0), now),
    stats: sanitizeStats(raw.stats),
  };

  state.combat = sanitizeCombat(raw.combat, state, now);
  return state;
}

// Elenco: só encantados que existem, com nível a partir de 1
function sanitizeRoster(raw: unknown): Record<string, OwnedEncantado> {
  const roster: Record<string, OwnedEncantado> = {};

  if (!isRecord(raw)) {
    return roster;
  }

  for (const [encantadoId, owned] of Object.entries(raw)) {
    if (hasEncantado(encantadoId) && isRecord(owned)) {
      roster[encantadoId] = {
        id: encantadoId,
        level: toInteger(owned.level, 1, 1),
        xp: toNumber(owned.xp, 0, 0),
        bond: toInteger(owned.bond, 0, 0),
      };
    }
  }

  return roster;
}

// Comitiva: só quem está no elenco, sem repetição e dentro do limite de vagas
function sanitizeParty(raw: unknown, roster: Record<string, OwnedEncantado>): string[] {
  const candidates = Array.isArray(raw) ? raw : [];
  const isOwnedId = (encantadoId: unknown): encantadoId is string =>
    typeof encantadoId === 'string' && encantadoId in roster;
  const members = candidates.filter(isOwnedId);
  const party = [...new Set(members)].slice(0, BALANCE.maxPartySize);

  // Com elenco e sem comitiva o jogo ficaria parado, então o primeiro do elenco entra
  const firstOwnedId = Object.keys(roster)[0];
  const needsMember = party.length === 0 && firstOwnedId !== undefined;
  return needsMember ? [firstOwnedId] : party;
}

// Contador { id: quantidade }: só ids que existem e quantidades inteiras a partir de 0
function sanitizeCounters(
  raw: unknown,
  isKnownId: (id: string) => boolean,
): Record<string, number> {
  const counters: Record<string, number> = {};

  if (!isRecord(raw)) {
    return counters;
  }

  for (const [id, amount] of Object.entries(raw)) {
    if (isKnownId(id)) {
      counters[id] = toInteger(amount, 0, 0);
    }
  }

  return counters;
}

// Melhorias: como um contador, mas respeitando o nível máximo de cada uma
function sanitizeUpgrades(raw: unknown): Record<string, number> {
  const levels = sanitizeCounters(raw, hasUpgrade);

  for (const upgradeId of Object.keys(levels)) {
    const maxLevel = getUpgrade(upgradeId).maxLevel ?? Infinity;
    levels[upgradeId] = Math.min(levels[upgradeId], maxLevel);
  }

  return levels;
}

// Estatísticas: números a partir de 0
function sanitizeStats(raw: unknown): GameStats {
  const stats = isRecord(raw) ? raw : {};

  return {
    totalKills: toInteger(stats.totalKills, 0, 0),
    totalGoldEarned: toNumber(stats.totalGoldEarned, 0, 0),
    bossesDefeated: toInteger(stats.bossesDefeated, 0, 0),
    playTimeSeconds: toNumber(stats.playTimeSeconds, 0, 0),
  };
}

// Combate: mantém o inimigo salvo se ele fizer sentido no estágio. Senão, entra uma visagem nova.
function sanitizeCombat(raw: unknown, state: GameState, now: number): CombatState {
  const zone = getZoneForStage(state.stage);
  const freshCombat = createInitialState(now).combat;

  if (!isRecord(raw) || typeof raw.enemyId !== 'string') {
    return freshCombat;
  }

  const isBoss = raw.isBoss === true && raw.enemyId === zone.bossId;
  const isCommonEnemy = raw.isBoss !== true && zone.enemyIds.includes(raw.enemyId);
  const enemyMaxHp = toNumber(raw.enemyMaxHp, 0, 0);
  const enemyHp = Math.min(toNumber(raw.enemyHp, 0, 0), enemyMaxHp);
  const bossTimeLeft = isBoss ? Math.min(toNumber(raw.bossTimeLeft, 0, 0), zone.bossTimeLimit) : 0;
  const isBossOutOfTime = isBoss && bossTimeLeft <= 0;
  const isUsable = (isBoss || isCommonEnemy) && enemyHp > 0 && !isBossOutOfTime;

  if (!isUsable) {
    return freshCombat;
  }

  return {
    enemyId: raw.enemyId,
    enemyHp,
    enemyMaxHp,
    isBoss,
    bossTimeLeft,
    attackProgress: sanitizeAttackProgress(raw.attackProgress, state.party),
  };
}

// Barras de ataque: uma por encantado da comitiva, entre 0 e 1
function sanitizeAttackProgress(raw: unknown, party: readonly string[]): Record<string, number> {
  const saved = isRecord(raw) ? raw : {};
  const attackProgress: Record<string, number> = {};

  for (const encantadoId of party) {
    attackProgress[encantadoId] = Math.min(toNumber(saved[encantadoId], 0, 0), 1);
  }

  return attackProgress;
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S   D E   C O N F E R Ê N C I A

// Número finito e não menor que o mínimo. Qualquer outra coisa vira o valor padrão.
function toNumber(value: unknown, fallback: number, minimum: number): number {
  const isValid = typeof value === 'number' && Number.isFinite(value);
  return isValid ? Math.max(value, minimum) : fallback;
}

// Igual a toNumber, mas sem casas decimais
function toInteger(value: unknown, fallback: number, minimum: number): number {
  return Math.floor(toNumber(value, fallback, minimum));
}
