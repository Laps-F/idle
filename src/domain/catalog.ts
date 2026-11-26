/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/catalog.ts
 * O que faz: consulta as definições de src/data por id e descobre a zona de
 * um estágio. É a única porta por onde o resto do código busca um dado
 * específico, em vez de percorrer as listas.
 *
 * Mapa:
 *   1. Índices por id
 *   2. Consultas por id
 *   3. Zonas e estágios
 *   4. Expedições: mapas e ladrilhos
 *   5. Ferramentas
 */

import {
  AMULET_BASES,
  AMULET_RARITIES,
  ENCANTADOS,
  ENEMIES,
  ITEMS,
  JUAZEIRO_NODES,
  EXPEDITION_LOOT,
  EXPEDITION_MAPS,
  TILES,
  UPGRADES,
  ZONES,
} from '../data';
import type {
  AmuletBaseDef,
  AmuletRarityDef,
  EncantadoDef,
  EnemyDef,
  ExpeditionLootDef,
  ExpeditionMapDef,
  ItemDef,
  JuazeiroNodeDef,
  Rarity,
  TileDef,
  UpgradeDef,
  ZoneDef,
} from './types';

// =============================================================================
// =============================================================================
// Í N D I C E S   P O R   I D

const ENCANTADOS_BY_ID = indexById(ENCANTADOS);
const ENEMIES_BY_ID = indexById(ENEMIES);
const ITEMS_BY_ID = indexById(ITEMS);
const UPGRADES_BY_ID = indexById(UPGRADES);
const AMULET_BASES_BY_ID = indexById(AMULET_BASES);
const JUAZEIRO_NODES_BY_ID = indexById(JUAZEIRO_NODES);
const ZONES_BY_ID = indexById(ZONES);
const EXPEDITION_MAPS_BY_ID = indexById(EXPEDITION_MAPS);
const EXPEDITION_LOOT_BY_MAP = new Map(EXPEDITION_LOOT.map((loot) => [loot.mapId, loot]));
const TILES_BY_SYMBOL = new Map(TILES.map((tile) => [tile.symbol, tile]));


// =============================================================================
// =============================================================================
// C O N S U L T A S   P O R   I D

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


// Definição do tipo de amuleto. Lança erro se o id não existir.
export function getAmuletBase(id: string): AmuletBaseDef {
  return getOrThrow(AMULET_BASES_BY_ID, id, 'Tipo de amuleto');
}

// Diz se existe um tipo de amuleto com esse id
export function hasAmuletBase(id: string): boolean {
  return AMULET_BASES_BY_ID.has(id);
}

// Nó do juazeiro pelo id. Id desconhecido é erro de programação e lança exceção.
export function getJuazeiroNode(id: string): JuazeiroNodeDef {
  return getOrThrow(JUAZEIRO_NODES_BY_ID, id, 'Nó do juazeiro');
}

// Diz se existe um nó do juazeiro com esse id
export function hasJuazeiroNode(id: string): boolean {
  return JUAZEIRO_NODES_BY_ID.has(id);
}

// Linha da tabela de raridades dos amuletos. Lança erro se a raridade não estiver na tabela.
export function getAmuletRarity(rarity: Rarity): AmuletRarityDef {
  const definition = AMULET_RARITIES.find((candidate) => candidate.rarity === rarity);

  if (definition === undefined) {
    throw new Error(`Raridade "${rarity}" não existe em src/data/amulets.ts.`);
  }

  return definition;
}

// Diz se o texto é uma raridade da tabela dos amuletos
export function isAmuletRarity(value: unknown): value is Rarity {
  return AMULET_RARITIES.some((candidate) => candidate.rarity === value);
}


// =============================================================================
// =============================================================================
// Z O N A S   E   E S T Á G I O S

/**
 * Descobre a zona a que um estágio pertence.
 *
 * Os estágios são contados em sequência pela ordem das zonas em src/data/zones.ts:
 * a primeira zona ocupa os estágios 1 a stageCount, a segunda continua daí.
 *
 * @param stage Número do estágio, a partir de 1.
 * @returns A definição da zona.
 * @throws Error se não houver nenhuma zona cadastrada.
 *
 * Casos de borda: estágio além da última zona devolve a última, porque o jogo
 * continua nela até existir a próxima. Estágio menor que 1 devolve a primeira.
 */
export function getZoneForStage(stage: number): ZoneDef {
  let lastStageOfZone = 0;

  for (const zone of ZONES) {
    lastStageOfZone += zone.stageCount;
    if (stage <= lastStageOfZone) {
      return zone;
    }
  }

  const lastZone = ZONES[ZONES.length - 1];

  if (lastZone === undefined) {
    throw new Error('Nenhuma zona cadastrada em src/data/zones.ts.');
  }

  return lastZone;
}


// Zona pelo id (cada mapa de expedição é ligado a uma zona)
export function getZone(id: string): ZoneDef {
  return getOrThrow(ZONES_BY_ID, id, 'Zona');
}

export function hasZone(id: string): boolean {
  return ZONES_BY_ID.has(id);
}


// =============================================================================
// =============================================================================
// E X P E D I Ç Õ E S :   M A P A S   E   L A D R I L H O S

export function getExpeditionMap(id: string): ExpeditionMapDef {
  return getOrThrow(EXPEDITION_MAPS_BY_ID, id, 'Mapa');
}

export function hasExpeditionMap(id: string): boolean {
  return EXPEDITION_MAPS_BY_ID.has(id);
}

// Saque próprio de um mapa de expedição (src/data/expeditionLoot.ts)
export function getExpeditionLoot(mapId: string): ExpeditionLootDef {
  return getOrThrow(EXPEDITION_LOOT_BY_MAP, mapId, 'Saque de expedição');
}

export function hasExpeditionLoot(mapId: string): boolean {
  return EXPEDITION_LOOT_BY_MAP.has(mapId);
}

/**
 * Ladrilho de uma coluna e linha do mapa.
 *
 * @param map Mapa consultado.
 * @param column Coluna, a partir de 0, da esquerda para a direita.
 * @param row Linha, a partir de 0, de cima para baixo.
 * @returns A definição do ladrilho, ou null fora do mapa ou com símbolo que não existe.
 */
export function getTileAt(map: ExpeditionMapDef, column: number, row: number): TileDef | null {
  const symbol = map.layout[row]?.[column];
  return symbol === undefined ? null : (TILES_BY_SYMBOL.get(symbol) ?? null);
}

// Largura e altura do mapa, em ladrilhos. A largura é a da primeira linha.
export function getMapSize(map: ExpeditionMapDef): { width: number; height: number } {
  return { width: map.layout[0]?.length ?? 0, height: map.layout.length };
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
