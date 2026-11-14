/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/index.ts
 * O que faz: é a porta de entrada dos dados. O motor consulta as definições
 * por id aqui, em vez de percorrer as listas.
 *
 * Mapa:
 *   1. Índices por id
 *   2. Consultas
 *   3. Ferramentas
 */

import type { EncantadoDef, EnemyDef, ItemDef, UpgradeDef, ZoneDef } from '../types/game';
import { ENCANTADOS } from './encantados';
import { ENEMIES } from './enemies';
import { ITEMS } from './items';
import { UPGRADES } from './upgrades';
import { ZONES } from './zones';

export { BALANCE, MS_PER_SECOND } from './balance';
export { ENCANTADOS } from './encantados';
export { ENEMIES } from './enemies';
export { ITEMS } from './items';
export { SYNERGIES } from './synergies';
export { UPGRADES } from './upgrades';
export { ZONES } from './zones';

// =============================================================================
// =============================================================================
// Í N D I C E S   P O R   I D

const ENCANTADOS_BY_ID = indexById(ENCANTADOS);
const ENEMIES_BY_ID = indexById(ENEMIES);
const ITEMS_BY_ID = indexById(ITEMS);
const UPGRADES_BY_ID = indexById(UPGRADES);


// =============================================================================
// =============================================================================
// C O N S U L T A S

// Definição do encantado. Lança erro se o id não existir.
export function getEncantado(id: string): EncantadoDef {
  return getOrThrow(ENCANTADOS_BY_ID, id, 'Encantado');
}

// Diz se existe um encantado com esse id
export function hasEncantado(id: string): boolean {
  return ENCANTADOS_BY_ID.has(id);
}

// Definição da visagem ou do chefe. Lança erro se o id não existir.
export function getEnemy(id: string): EnemyDef {
  return getOrThrow(ENEMIES_BY_ID, id, 'Inimigo');
}

// Diz se existe um inimigo com esse id
export function hasEnemy(id: string): boolean {
  return ENEMIES_BY_ID.has(id);
}

// Definição da Oferenda. Lança erro se o id não existir.
export function getItem(id: string): ItemDef {
  return getOrThrow(ITEMS_BY_ID, id, 'Item');
}

// Diz se existe um item com esse id
export function hasItem(id: string): boolean {
  return ITEMS_BY_ID.has(id);
}

// Definição da melhoria. Lança erro se o id não existir.
export function getUpgrade(id: string): UpgradeDef {
  return getOrThrow(UPGRADES_BY_ID, id, 'Melhoria');
}

// Diz se existe uma melhoria com esse id
export function hasUpgrade(id: string): boolean {
  return UPGRADES_BY_ID.has(id);
}

// Zona a que o estágio pertence. Depois da última zona, o jogo continua nela.
export function getZoneForStage(stage: number): ZoneDef {
  let lastStageOfZone = 0;

  for (const zone of ZONES) {
    lastStageOfZone += zone.stageCount;
    if (stage <= lastStageOfZone) {
      return zone;
    }
  }

  return ZONES[ZONES.length - 1];
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S

// Monta um mapa id -> definição para consulta rápida
function indexById<T extends { id: string }>(definitions: readonly T[]): Map<string, T> {
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

// Busca no mapa e avisa com clareza quando um dado aponta para um id que não existe
function getOrThrow<T>(definitionsById: Map<string, T>, id: string, kind: string): T {
  const definition = definitionsById.get(id);

  if (definition === undefined) {
    throw new Error(`${kind} com id "${id}" não existe em src/data.`);
  }

  return definition;
}
