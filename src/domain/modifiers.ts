/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/modifiers.ts
 * O que faz: junta melhorias, sinergias, dons, amuletos, Raízes e juazeiro nos
 * multiplicadores finais que o combate usa.
 *
 * Mapa:
 *   1. Sinergias ativas
 *   2. Multiplicadores finais
 *   3. Ferramentas
 */

import { BALANCE } from '../data/balance';
import { SYNERGIES } from '../data/synergies';
import { UPGRADES } from '../data/upgrades';
import { getPartyAmuletBonuses } from './amulets';
import { findGift, getEncantado } from './catalog';
import { getRootsMultiplier } from './formulas';
import { getJuazeiroBonuses } from './juazeiro';
import type {
  AmuletBonus,
  DayPhase,
  GameState,
  GiftStat,
  ModifierStat,
  Modifiers,
  StatBonuses,
  SynergyDef,
} from './types';

// =============================================================================
// =============================================================================
// S I N E R G I A S   A T I V A S

// Sinergias que a comitiva acende na fase do dia informada
export function getActiveSynergies(party: readonly string[], dayPhase: DayPhase): SynergyDef[] {
  const membersByOrigin = countMembersByOrigin(party);

  return SYNERGIES.filter((synergy) => {
    const memberCount = membersByOrigin.get(synergy.origin) ?? 0;
    const hasEnoughMembers = memberCount >= synergy.membersNeeded;
    const isPhaseRight = synergy.dayPhase === undefined || synergy.dayPhase === dayPhase;
    return hasEnoughMembers && isPhaseRight;
  });
}


// =============================================================================
// =============================================================================
// M U L T I P L I C A D O R E S   F I N A I S

/**
 * Calcula os multiplicadores finais que o combate usa.
 *
 * Para cada atributo: (1 + soma das melhorias) × (1 + soma das sinergias) ×
 * (1 + soma dos amuletos vestidos pela comitiva) × (1 + soma dos dons da comitiva).
 * Dano e Patacas ainda são multiplicados pelo bônus das Raízes fincadas.
 * Dano e dano em chefes ganham também o fator do juazeiro (1 + bônus do galho).
 * A chance de crítico é uma soma: base + melhorias + sinergias + amuletos +
 * juazeiro + dons, limitada a 100%.
 * As chances de Rastro, de Oferenda e de amuleto partem da chance de achado e
 * ganham o fator próprio do juazeiro. As de Rastro e de Oferenda ganham também o
 * fator do dom (1 + dom), como o da Caipora e o do Curupira.
 *
 * @param state Estado do jogo. Só é lido.
 * @param dayPhase Fase do dia. Algumas sinergias só valem de dia ou de noite.
 * @returns Multiplicadores por atributo. critChance é uma probabilidade de 0 a 1.
 */
export function getModifiers(state: GameState, dayPhase: DayPhase): Modifiers {
  const upgradeBonus = sumUpgradeBonuses(state.upgrades);
  const synergyBonus = sumSynergyBonuses(getActiveSynergies(state.party, dayPhase));
  const amuletBonus = sumAmuletBonuses(getPartyAmuletBonuses(state));
  const juazeiro = getJuazeiroBonuses(state.juazeiro);
  const rootsMultiplier = getRootsMultiplier(state.roots);
  const giftBonus = sumGiftBonuses(state.party);
  const multiplierOf = (stat: ModifierStat) =>
    (1 + upgradeBonus[stat]) *
    (1 + synergyBonus[stat]) *
    (1 + amuletBonus[stat]) *
    (1 + giftBonus[stat]);
  const dropChance = multiplierOf('dropChance');
  const critChance =
    BALANCE.baseCritChance +
    upgradeBonus.critChance +
    synergyBonus.critChance +
    amuletBonus.critChance +
    juazeiro.critChance +
    giftBonus.critChance;

  return {
    damage: multiplierOf('damage') * rootsMultiplier * (1 + juazeiro.damage),
    bossDamage: multiplierOf('bossDamage') * (1 + juazeiro.bossDamage),
    attackSpeed: multiplierOf('attackSpeed'),
    gold: multiplierOf('gold') * rootsMultiplier,
    dropChance,
    critChance: Math.min(1, critChance),
    trailChance: dropChance * (1 + juazeiro.trailChance) * (1 + giftBonus.trailChance),
    itemChance: dropChance * (1 + juazeiro.itemChance) * (1 + giftBonus.itemChance),
    amuletChance: dropChance * (1 + juazeiro.amuletChance),
  };
}

// Multiplicadores de dia e de noite, calculados uma vez por trecho simulado
export function getModifiersByPhase(state: GameState): Record<DayPhase, Modifiers> {
  return {
    dia: getModifiers(state, 'dia'),
    noite: getModifiers(state, 'noite'),
  };
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S

// Quantos encantados da comitiva existem em cada origem
function countMembersByOrigin(party: readonly string[]): Map<string, number> {
  const membersByOrigin = new Map<string, number>();

  for (const encantadoId of party) {
    const origin = getEncantado(encantadoId).origin;
    membersByOrigin.set(origin, (membersByOrigin.get(origin) ?? 0) + 1);
  }

  return membersByOrigin;
}

// Soma dos bônus das melhorias compradas, por atributo
function sumUpgradeBonuses(upgradeLevels: Record<string, number>): StatBonuses {
  const bonuses = createEmptyBonuses();

  for (const upgrade of UPGRADES) {
    const level = upgradeLevels[upgrade.id] ?? 0;
    bonuses[upgrade.stat] += upgrade.bonusPerLevel * level;
  }

  return bonuses;
}

// Soma dos bônus das sinergias acesas, por atributo
function sumSynergyBonuses(synergies: readonly SynergyDef[]): StatBonuses {
  const bonuses = createEmptyBonuses();

  for (const synergy of synergies) {
    bonuses[synergy.stat] += synergy.bonus;
  }

  return bonuses;
}

// Soma dos dons de quem está na comitiva, por atributo (src/data/gifts.ts)
function sumGiftBonuses(party: readonly string[]): Record<GiftStat, number> {
  const bonuses: Record<GiftStat, number> = {
    ...createEmptyBonuses(),
    trailChance: 0,
    itemChance: 0,
  };

  for (const encantadoId of party) {
    const gift = findGift(encantadoId);

    if (gift !== null) {
      bonuses[gift.stat] += gift.bonus;
    }
  }

  return bonuses;
}

// Soma dos bônus dos amuletos em vigor, por atributo
function sumAmuletBonuses(amuletBonuses: readonly AmuletBonus[]): StatBonuses {
  const bonuses = createEmptyBonuses();

  for (const bonus of amuletBonuses) {
    bonuses[bonus.stat] += bonus.value;
  }

  return bonuses;
}

// Tabela de bônus zerada
function createEmptyBonuses(): StatBonuses {
  return { damage: 0, bossDamage: 0, attackSpeed: 0, gold: 0, dropChance: 0, critChance: 0 };
}

// Diz se o texto é o nome de um atributo que melhoria, sinergia ou amuleto podem alterar
export function isModifierStat(value: unknown): value is ModifierStat {
  return typeof value === 'string' && value in createEmptyBonuses();
}
