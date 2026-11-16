/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/data.test.ts
 * O que faz: confere se os dados de src/data não apontam para ids que não
 * existem. Rode com "npm test" depois de mexer em qualquer arquivo de dados.
 */

import { describe, expect, it } from 'vitest';

import {
  AMULET_BASES,
  AMULET_RARITIES,
  ENCANTADOS,
  ENEMIES,
  UPGRADES,
  ZONES,
} from '../src/data';
import { getZoneForStage, hasEncantado, hasEnemy, hasItem } from '../src/domain/catalog';

describe('dados do jogo', () => {
  it('não repete ids', () => {
    for (const definitions of [ENCANTADOS, ENEMIES, UPGRADES, ZONES, AMULET_BASES]) {
      const ids = definitions.map((definition) => definition.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('tem amuletos com um atributo principal por tipo e raridades sem repetição', () => {
    const stats = AMULET_BASES.map((base) => base.stat);
    const rarities = AMULET_RARITIES.map((definition) => definition.rarity);

    expect(new Set(stats).size).toBe(stats.length);
    expect(new Set(rarities).size).toBe(rarities.length);
    expect(AMULET_BASES.every((base) => base.baseBonus > 0)).toBe(true);
    expect(AMULET_RARITIES.every((definition) => definition.weight > 0)).toBe(true);
    expect(AMULET_RARITIES.every((definition) => definition.maxLevel > 0)).toBe(true);
    // Todo amuleto precisa de atributos diferentes para o principal e os secundários
    const mostExtras = Math.max(...AMULET_RARITIES.map((definition) => definition.extraBonuses));
    expect(mostExtras).toBeLessThan(AMULET_BASES.length);
  });

  it('só pede em pactos Oferendas que existem', () => {
    const offeringIds = ENCANTADOS.flatMap((encantado) => encantado.pact?.offerings ?? []).map(
      (offering) => offering.itemId,
    );
    expect(offeringIds.every(hasItem)).toBe(true);
  });

  it('só deixa cair itens que existem', () => {
    const dropIds = ENEMIES.flatMap((enemy) => enemy.drops).map((drop) => drop.itemId);
    expect(dropIds.every(hasItem)).toBe(true);
  });

  it('só usa nas zonas inimigos e encantados que existem', () => {
    for (const zone of ZONES) {
      expect(zone.enemyIds.length).toBeGreaterThan(0);
      expect(zone.enemyIds.every(hasEnemy)).toBe(true);
      expect(hasEnemy(zone.bossId)).toBe(true);
      expect(zone.encounters.every((encounter) => hasEncantado(encounter.encantadoId))).toBe(true);
    }
  });

  it('dá um jeito de conseguir toda Oferenda pedida e todo encantado de pacto', () => {
    const droppedIds = new Set(ENEMIES.flatMap((enemy) => enemy.drops).map((drop) => drop.itemId));
    const encounterIds = new Set(
      ZONES.flatMap((zone) => zone.encounters).map((encounter) => encounter.encantadoId),
    );

    for (const encantado of ENCANTADOS) {
      if (encantado.pact !== null) {
        expect(encounterIds.has(encantado.id)).toBe(true);
        expect(encantado.pact.offerings.every((offering) => droppedIds.has(offering.itemId))).toBe(
          true,
        );
      }
    }
  });

  it('tem pelo menos um encantado inicial', () => {
    expect(ENCANTADOS.some((encantado) => encantado.isStarter)).toBe(true);
  });

  it('acha a zona de qualquer estágio', () => {
    expect(getZoneForStage(1).id).toBe('mata-atlantica');
    expect(getZoneForStage(10).id).toBe('mata-atlantica');
    expect(getZoneForStage(0).id).toBe('mata-atlantica');
    expect(getZoneForStage(9999).id).toBe(ZONES[ZONES.length - 1]?.id);
  });
});
