/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/saveManager.ts
 * O que faz: cuida de tudo que envolve gravar e ler o jogo.
 *   - grava no localStorage sem travar o jogo (no máximo uma vez a cada 5 s);
 *   - transforma o salvamento em código de exportação e de volta;
 *   - atualiza salvamentos de versões antigas;
 *   - confere e conserta um salvamento antes de usar.
 *
 * Regra de tipagem: tudo que vem de fora (localStorage, código colado) entra
 * como "unknown" e só vira GameState depois de passar pela conferência.
 *
 * Mapa:
 *   1. Constantes e tipos (incluindo os payloads de salvamento)
 *   2. Gravação no localStorage
 *   3. Exportação e importação
 *   4. Migração entre versões
 *   5. Conferência do salvamento
 *   6. Ferramentas de conferência
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware';

import { BALANCE } from '../data/balance';
import {
  getAmuletRarity,
  getJuazeiroNode,
  getUpgrade,
  getZoneForStage,
  hasAmuletBase,
  hasEncantado,
  hasItem,
  hasJuazeiroNode,
  hasEnemy,
  hasExpeditionMap,
  hasUpgrade,
  isAmuletRarity,
} from '../domain/catalog';
import { getJuazeiroBonuses, getSpentRoots } from '../domain/juazeiro';
import { isModifierStat } from '../domain/modifiers';
import { createCommonEnemyCombat, createInitialState } from '../domain/state';
import type {
  Amulet,
  AmuletBonus,
  CombatState,
  GameState,
  GameStats,
  ExpeditionLoot,
  ExpeditionState,
  OwnedEncantado,
} from '../domain/types';
import { decodeBase64, encodeBase64 } from '../utils/base64';
import { isRecord } from '../utils/object';
import type { RandomSource } from '../utils/random';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

export const SAVE_STORAGE_KEY = 'encantados-save';

// Um salvamento ilegível é guardado nesta chave em vez de ser apagado
const CORRUPTED_BACKUP_SUFFIX = '-corrompido';

// Número no fim do id de um amuleto, como o 12 de "amuleto-12"
const AMULET_ID_NUMBER = /-(\d+)$/;

// Marca que identifica um código de exportação deste jogo
const SAVE_SIGNATURE = 'encantados';

const IMPORT_ERRORS = {
  unreadable: 'Não consegui ler esse código. Confira se ele foi copiado inteiro.',
  wrongGame: 'Esse código não é um salvamento do Encantados.',
  newerVersion:
    'Esse salvamento veio de uma versão mais nova do jogo. Atualize a página e tente de novo.',
} as const;

// Payload gravado no localStorage: o estado do jogo e a versão do formato
export type PersistedSave = StorageValue<GameState>;

// Payload do código de exportação, antes de virar Base64
export interface ExportedSave {
  game: string; // sempre SAVE_SIGNATURE
  version: number; // versão do formato do estado
  exportedAt: number; // instante da exportação, em ms
  state: GameState;
}

// Salvamento lido de fora, ainda sem conferência: só se sabe a versão
interface UnverifiedSave {
  version: number;
  state: unknown;
}

// Código de exportação lido de fora, ainda sem conferência
interface UnverifiedExport extends UnverifiedSave {
  game: string;
}

export interface ThrottledStorage {
  storage: PersistStorage<GameState>;
  flush: () => void; // grava agora o que estiver pendente
  disable: () => void; // para de gravar de vez e descarta o que estava pendente
}

export type DecodeResult = { ok: true; state: GameState } | { ok: false; error: string };

type Migration = (save: Record<string, unknown>) => Record<string, unknown>;


// =============================================================================
// =============================================================================
// G R A V A Ç Ã O   N O   L O C A L S T O R A G E

/**
 * Cria o armazenamento que o persist do Zustand usa, com gravação espaçada.
 *
 * O tick muda o estado 10 vezes por segundo, e gravar no disco nesse ritmo
 * travaria o jogo. Este armazenamento guarda só o último estado recebido e
 * grava no localStorage no máximo uma vez a cada "intervalMs".
 *
 * @param intervalMs Intervalo mínimo entre duas gravações, em milissegundos.
 * @returns O armazenamento, mais "flush" (grava agora) e "disable" (para de gravar).
 *
 * Casos de borda:
 * - A leitura já devolve o estado migrado e conferido. Salvamento ilegível vira
 *   jogo novo, e o texto original fica guardado em uma chave de cópia.
 * - Sem localStorage (modo privado, cookies bloqueados), ler devolve null e
 *   gravar não faz nada. O jogo roda, só não salva.
 * - Depois de "disable", nenhuma gravação acontece até a página ser recarregada.
 */
export function createThrottledStorage(intervalMs: number): ThrottledStorage {
  let pending: { name: string; value: PersistedSave } | null = null;
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
    getItem: (name) => readSave(name, Date.now(), Math.random),
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

// Lê o salvamento, migra e confere. Se estiver ilegível, guarda uma cópia e devolve null.
function readSave(name: string, now: number, random: RandomSource): PersistedSave | null {
  const raw = getLocalStorage()?.getItem(name) ?? null;

  if (raw === null) {
    return null;
  }

  const unverified = parseUnverifiedSave(raw);

  if (unverified === null) {
    console.warn('Salvamento ilegível. Uma cópia foi guardada e o jogo começa do zero.');
    writeToLocalStorage(name + CORRUPTED_BACKUP_SUFFIX, raw);
    return null;
  }

  const migrated = migrateSave(unverified.state, unverified.version);
  return { state: sanitizeGameState(migrated, now, random), version: BALANCE.saveVersion };
}

// Texto do localStorage -> salvamento ainda sem conferência. Null se não for JSON no formato certo.
function parseUnverifiedSave(raw: string): UnverifiedSave | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const hasExpectedShape = isRecord(parsed) && 'state' in parsed;

    if (!hasExpectedShape) {
      return null;
    }

    // Salvamento sem versão é tratado como da versão atual
    const version = typeof parsed.version === 'number' ? parsed.version : BALANCE.saveVersion;
    return { version, state: parsed.state };
  } catch {
    // Texto que não é JSON: quem chama guarda a cópia e avisa
    return null;
  }
}

// Tamanho, em caracteres, do salvamento gravado no localStorage. Null se não houver nenhum.
export function getSavedGameSize(): number | null {
  const raw = getLocalStorage()?.getItem(SAVE_STORAGE_KEY) ?? null;
  return raw === null ? null : raw.length;
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

/**
 * Transforma um código de exportação em um estado pronto para usar.
 *
 * @param code Código gerado por encodeSave (JSON em Base64).
 * @param now Instante atual em ms. Vira a marca de tempo do estado importado.
 * @param random Fonte de sorteio, usada se o combate do código precisar ser refeito.
 * @returns O estado migrado e conferido, ou a mensagem do que deu errado.
 *
 * Casos de borda:
 * - Código cortado, que não é Base64 ou não é JSON: erro "não consegui ler".
 * - Código de outro jogo: erro próprio.
 * - Código de uma versão mais nova que a do jogo: erro pedindo para atualizar a página.
 * - Importar nunca rende progresso offline: a marca de tempo recomeça em "now",
 *   não importa há quanto tempo o código foi exportado.
 * - Campos estragados ou adulterados são consertados pela conferência, em vez de recusados.
 */
export function decodeSave(code: string, now: number, random: RandomSource): DecodeResult {
  const exported = parseUnverifiedExport(code);

  if (exported === null) {
    return { ok: false, error: IMPORT_ERRORS.unreadable };
  }
  if (exported.game !== SAVE_SIGNATURE) {
    return { ok: false, error: IMPORT_ERRORS.wrongGame };
  }
  if (exported.version > BALANCE.saveVersion) {
    return { ok: false, error: IMPORT_ERRORS.newerVersion };
  }

  const migrated = migrateSave(exported.state, exported.version);
  const state = sanitizeGameState(migrated, now, random);
  return { ok: true, state: { ...state, lastSaveTimestamp: now } };
}

// Decodifica o código. Devolve null se não for Base64, JSON ou não tiver o formato esperado.
function parseUnverifiedExport(code: string): UnverifiedExport | null {
  try {
    const parsed: unknown = JSON.parse(decodeBase64(code));

    if (!isRecord(parsed)) {
      return null;
    }

    const { game, version, state } = parsed;
    const hasExpectedShape = typeof game === 'string' && typeof version === 'number';
    return hasExpectedShape ? { game, version, state } : null;
  } catch {
    // Código cortado ou digitado errado: quem chama mostra a mensagem para a pessoa
    return null;
  }
}


// =============================================================================
// =============================================================================
// M I G R A Ç Ã O   E N T R E   V E R S Õ E S

// Uma função por versão de origem: MIGRATIONS[1] leva um salvamento da versão 1 para a 2.
// Mudou o formato do GameState? Suba BALANCE.saveVersion e registre aqui como converter
// o formato antigo. Nunca apague uma migração: quem ficou meses sem abrir o jogo passa por todas.
const MIGRATIONS: Record<number, Migration> = {
  // Versão 1 -> 2: entraram os amuletos. Quem jogava antes começa sem nenhum, com a
  // mochila vazia, sem Cavacos e com o desmanche automático desligado.
  1: (save) => ({
    ...save,
    amulets: {},
    equipped: {},
    shavings: 0,
    autoSalvage: null,
    nextAmuletNumber: 1,
    stats: { ...(isRecord(save.stats) ? save.stats : {}), amuletsFound: 0 },
  }),

  // Versão 2 -> 3: entrou a Rebrota. Quem jogava antes está na edição 1, sem
  // recorde (então tudo que já alcançou conta para as primeiras Raízes), sem nós
  // no juazeiro e com a compra automática desligada. O tempo desta edição é o
  // tempo de jogo inteiro até aqui.
  2: (save) => {
    const stats = isRecord(save.stats) ? save.stats : {};

    return {
      ...save,
      juazeiro: {},
      edition: 1,
      recordStage: 0,
      editionSeconds: toNumber(stats.playTimeSeconds, 0, 0),
      autoBuy: false,
      stats: { ...stats, bossesFailed: 0 },
    };
  },

  // Versão 3 -> 4: entrou o protótipo do mundo aberto, com a posição da personagem
  // no campo "world". A versão 5 tirou esse campo, então aqui não há o que mudar.
  3: (save) => save,

  // Versão 4 -> 5: o mundo aberto virou expedição. A posição no mapa deixa de ser
  // salva e entra a expedição em andamento, que começa vazia (na clareira).
  4: (save) => {
    const { world: _world, ...rest } = save;
    return { ...rest, expedition: null };
  },
};

/**
 * Aplica, em ordem, as migrações que faltam para o salvamento chegar à versão atual.
 *
 * @param save Estado lido de fora, ainda sem conferência.
 * @param fromVersion Versão em que o salvamento foi gravado.
 * @returns O estado no formato da versão atual, ainda sem conferência.
 *
 * Casos de borda: versão igual ou maior que a atual não muda nada. Versão sem
 * migração registrada é pulada. Estado que não é um objeto é devolvido como veio,
 * e a conferência cuida dele depois.
 */
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

/**
 * Monta um estado válido a partir de qualquer coisa lida do disco ou importada.
 *
 * É a fronteira entre o mundo de fora e o jogo: recebe "unknown" e devolve um
 * GameState em que o motor pode confiar.
 *
 * @param raw Estado lido de fora. Pode ser qualquer coisa.
 * @param now Instante atual em ms. Limita a marca de tempo e serve de valor padrão.
 * @param random Fonte de sorteio, usada se o combate precisar ser refeito.
 * @returns Um GameState completo e coerente.
 *
 * Casos de borda:
 * - "raw" que não é um objeto: devolve um jogo novo.
 * - Campo ausente ou do tipo errado: recebe o valor de um jogo novo.
 * - Número negativo, NaN ou infinito: vira o mínimo permitido ou o valor padrão.
 * - Id que não existe mais nos dados (encantado, item, melhoria): é descartado.
 * - Comitiva com gente fora do elenco, repetida ou acima do limite: é corrigida.
 *   Elenco sem comitiva recebe o primeiro do elenco, para o jogo não ficar parado.
 * - Marca de tempo no futuro: é trazida para "now", para não render tempo que não passou.
 * - Combate com inimigo que não é da zona, sem vida ou com chefe sem tempo: é refeito.
 * - Amuleto de tipo ou raridade que não existe, ou sem nenhum bônus válido: é descartado.
 *   Nível de entalhe acima do máximo da raridade: é limitado ao máximo.
 * - Amuleto vestido por quem não está no elenco, ou o mesmo amuleto em dois
 *   encantados: o vínculo inválido é desfeito e o amuleto volta para a mochila.
 * - O contador de ids de amuleto nunca fica abaixo do maior id já usado, para dois
 *   amuletos nunca terem o mesmo id.
 * - Nó do juazeiro que não existe é descartado e nível acima do máximo é limitado.
 *   Se os nós custarem mais Raízes do que as fincadas, o juazeiro é zerado (as
 *   Raízes voltam a ficar livres).
 * - Edição abaixo de 1 vira 1. O tempo do chefe aceita o bônus do juazeiro.
 * - Expedição num mapa que não existe ou de um encantado que a pessoa não tem: é
 *   descartada (a comitiva fica na clareira). Linha da bolsa estragada é descartada.
 */
export function sanitizeGameState(raw: unknown, now: number, random: RandomSource): GameState {
  if (!isRecord(raw)) {
    return createInitialState(now, random);
  }

  const roster = sanitizeRoster(raw.roster);
  const party = sanitizeParty(raw.party, roster);
  const stage = toInteger(raw.stage, 1, 1);
  const amulets = sanitizeAmulets(raw.amulets);
  const roots = toInteger(raw.roots, 0, 0);
  const juazeiro = sanitizeJuazeiro(raw.juazeiro, roots);

  return {
    version: BALANCE.saveVersion,
    gold: toNumber(raw.gold, 0, 0),
    stage,
    maxStage: Math.max(stage, toInteger(raw.maxStage, stage, 1)),
    killsInStage: Math.min(toInteger(raw.killsInStage, 0, 0), getZoneForStage(stage).killsToBoss),
    autoProgress: raw.autoProgress !== false,
    party,
    roster,
    trails: sanitizeCounters(raw.trails, hasEncantado),
    inventory: sanitizeCounters(raw.inventory, hasItem),
    upgrades: sanitizeUpgrades(raw.upgrades),
    roots,
    juazeiro,
    edition: toInteger(raw.edition, 1, 1),
    recordStage: toInteger(raw.recordStage, 0, 0),
    editionSeconds: toNumber(raw.editionSeconds, 0, 0),
    autoBuy: raw.autoBuy === true,
    amulets,
    equipped: sanitizeEquipped(raw.equipped, roster, amulets),
    shavings: toInteger(raw.shavings, 0, 0),
    autoSalvage: isAmuletRarity(raw.autoSalvage) ? raw.autoSalvage : null,
    nextAmuletNumber: sanitizeNextAmuletNumber(raw.nextAmuletNumber, amulets),
    combat: sanitizeCombat(raw.combat, { stage, party, juazeiro }, random),
    expedition: sanitizeExpedition(raw.expedition, roster),
    lastSaveTimestamp: Math.min(toNumber(raw.lastSaveTimestamp, now, 0), now),
    stats: sanitizeStats(raw.stats),
  };
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
  const candidates: unknown[] = Array.isArray(raw) ? raw : [];
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

  for (const [upgradeId, level] of Object.entries(levels)) {
    const maxLevel = getUpgrade(upgradeId).maxLevel ?? Infinity;
    levels[upgradeId] = Math.min(level, maxLevel);
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
    amuletsFound: toInteger(stats.amuletsFound, 0, 0),
    bossesFailed: toInteger(stats.bossesFailed, 0, 0),
  };
}

// Juazeiro: só nós que existem, sem passar do máximo e sem gastar mais que as Raízes fincadas
function sanitizeJuazeiro(raw: unknown, roots: number): Record<string, number> {
  const levels = sanitizeCounters(raw, hasJuazeiroNode);

  for (const [nodeId, level] of Object.entries(levels)) {
    levels[nodeId] = Math.min(level, getJuazeiroNode(nodeId).maxLevel);
  }

  return getSpentRoots(levels) > roots ? {} : levels;
}

// Amuletos: só os de tipo e raridade que existem, com pelo menos um bônus válido
function sanitizeAmulets(raw: unknown): Record<string, Amulet> {
  const amulets: Record<string, Amulet> = {};

  if (!isRecord(raw)) {
    return amulets;
  }

  for (const [amuletId, saved] of Object.entries(raw)) {
    const amulet = sanitizeAmulet(amuletId, saved);

    if (amulet !== null) {
      amulets[amuletId] = amulet;
    }
  }

  return amulets;
}

// Um amuleto conferido, ou null se ele não pode ser aproveitado
function sanitizeAmulet(amuletId: string, raw: unknown): Amulet | null {
  if (!isRecord(raw) || typeof raw.baseId !== 'string' || !hasAmuletBase(raw.baseId)) {
    return null;
  }
  if (!isAmuletRarity(raw.rarity)) {
    return null;
  }

  const bonuses = sanitizeAmuletBonuses(raw.bonuses);
  const maxLevel = getAmuletRarity(raw.rarity).maxLevel;

  if (bonuses.length === 0) {
    return null;
  }

  return {
    id: amuletId,
    baseId: raw.baseId,
    rarity: raw.rarity,
    foundAtStage: toInteger(raw.foundAtStage, 1, 1),
    level: Math.min(toInteger(raw.level, 0, 0), maxLevel),
    bonuses,
  };
}

// Bônus de um amuleto: só atributos que existem, com valor positivo
function sanitizeAmuletBonuses(raw: unknown): AmuletBonus[] {
  const candidates: unknown[] = Array.isArray(raw) ? raw : [];
  const bonuses: AmuletBonus[] = [];

  for (const candidate of candidates) {
    if (isRecord(candidate) && isModifierStat(candidate.stat)) {
      const value = toNumber(candidate.value, 0, 0);

      if (value > 0) {
        bonuses.push({ stat: candidate.stat, value });
      }
    }
  }

  return bonuses;
}

// Quem veste o quê: só encantados do elenco, amuletos que existem e um dono por amuleto
function sanitizeEquipped(
  raw: unknown,
  roster: Record<string, OwnedEncantado>,
  amulets: Record<string, Amulet>,
): Record<string, string> {
  const equipped: Record<string, string> = {};
  const wornIds = new Set<string>();

  if (!isRecord(raw)) {
    return equipped;
  }

  for (const [encantadoId, amuletId] of Object.entries(raw)) {
    const isValid =
      typeof amuletId === 'string' &&
      encantadoId in roster &&
      amuletId in amulets &&
      !wornIds.has(amuletId);

    if (isValid) {
      equipped[encantadoId] = amuletId;
      wornIds.add(amuletId);
    }
  }

  return equipped;
}

// Próximo número de amuleto: nunca menor que o maior número já usado em um id, mais um
function sanitizeNextAmuletNumber(raw: unknown, amulets: Record<string, Amulet>): number {
  const usedNumbers = Object.keys(amulets).map((amuletId) => {
    const digits = AMULET_ID_NUMBER.exec(amuletId)?.[1];
    return digits === undefined ? 0 : Number(digits);
  });
  const lowestFreeNumber = Math.max(0, ...usedNumbers) + 1;

  return Math.max(toInteger(raw, 1, 1), lowestFreeNumber);
}

// O que a conferência do combate precisa saber do resto do estado
interface CombatContext {
  stage: number;
  party: readonly string[];
  juazeiro: Record<string, number>;
}

// Combate: mantém o inimigo salvo se ele fizer sentido no estágio. Senão, entra uma visagem nova.
function sanitizeCombat(raw: unknown, context: CombatContext, random: RandomSource): CombatState {
  const { stage, party, juazeiro } = context;
  const savedProgress = isRecord(raw) ? raw.attackProgress : undefined;
  const attackProgress = sanitizeAttackProgress(savedProgress, party);
  const freshCombat = createCommonEnemyCombat(stage, attackProgress, random);

  if (!isRecord(raw) || typeof raw.enemyId !== 'string') {
    return freshCombat;
  }

  const zone = getZoneForStage(stage);
  const isBoss = raw.isBoss === true && raw.enemyId === zone.bossId;
  const isCommonEnemy = raw.isBoss !== true && zone.enemyIds.includes(raw.enemyId);
  const enemyMaxHp = toNumber(raw.enemyMaxHp, 0, 0);
  const enemyHp = Math.min(toNumber(raw.enemyHp, 0, 0), enemyMaxHp);
  const bossTimeLimit = zone.bossTimeLimit + getJuazeiroBonuses(juazeiro).bossTime;
  const bossTimeLeft = isBoss ? Math.min(toNumber(raw.bossTimeLeft, 0, 0), bossTimeLimit) : 0;
  const isBossOutOfTime = isBoss && bossTimeLeft <= 0;
  const isUsable = (isBoss || isCommonEnemy) && enemyHp > 0 && !isBossOutOfTime;

  if (!isUsable) {
    return freshCombat;
  }

  return { enemyId: raw.enemyId, enemyHp, enemyMaxHp, isBoss, bossTimeLeft, attackProgress };
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


// Expedição em andamento: mapa e encantado que existem, e a bolsa conferida linha a linha
function sanitizeExpedition(
  raw: unknown,
  roster: Record<string, OwnedEncantado>,
): ExpeditionState | null {
  if (!isRecord(raw)) {
    return null;
  }

  const { mapId, encantadoId } = raw;
  const isValid =
    typeof mapId === 'string' &&
    hasExpeditionMap(mapId) &&
    typeof encantadoId === 'string' &&
    roster[encantadoId] !== undefined;

  if (!isValid) {
    return null;
  }

  const loot = Array.isArray(raw.loot) ? raw.loot.flatMap(sanitizeLootEntry) : [];
  return { mapId, encantadoId, loot };
}

// Uma linha da bolsa: visagem que existe, nível e contagem inteiros e positivos
function sanitizeLootEntry(raw: unknown): ExpeditionLoot[] {
  if (!isRecord(raw) || typeof raw.enemyId !== 'string' || !hasEnemy(raw.enemyId)) {
    return [];
  }

  const level = Math.floor(toNumber(raw.level, 0, 0));
  const count = Math.floor(toNumber(raw.count, 0, 0));
  return level >= 1 && count >= 1 ? [{ enemyId: raw.enemyId, level, count }] : [];
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
