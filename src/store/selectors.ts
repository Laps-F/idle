/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/selectors.ts
 * O que faz: prepara os dados para a tela. Cada seletor lê a store e devolve
 * um objeto simples, já com nomes resolvidos e valores calculados, pronto
 * para um componente mostrar. Assim os componentes ficam "burros": não
 * consultam dados nem fazem conta de jogo.
 *
 * Uso: const combat = useGameStore(selectCombatView);
 *
 * Otimização: cada seletor guarda o último resultado e devolve a MESMA
 * referência enquanto o conteúdo não muda. O componente só redesenha quando
 * algum valor que ele mostra mudou de verdade.
 *
 * Mapa:
 *   1. Tipos das visões
 *   2. Seletores
 *   3. Construção de cada visão
 *   4. Ferramentas
 */

import { ENCANTADOS, ITEMS, UPGRADES } from '../data';
import { canChallengeBoss } from '../domain/actions';
import { getEncantado, getEnemy, getItem, getZoneForStage } from '../domain/catalog';
import { getClockInfo } from '../domain/clock';
import { getUpgradeCost, getXpToNextLevel, isUpgradeMaxed } from '../domain/formulas';
import type { DayPhase, MoonPhase, Origin } from '../domain/types';
import { isDeepEqual } from '../utils/object';
import type { GameSnapshot } from './types';

// =============================================================================
// =============================================================================
// T I P O S   D A S   V I S Õ E S

export interface LoopView {
  tickCount: number;
  lastTickTimestamp: number;
  playTimeSeconds: number;
  isOpenInAnotherTab: boolean;
}

export interface CombatView {
  zoneName: string;
  stage: number;
  maxStage: number;
  enemyName: string;
  isBoss: boolean;
  enemyHp: number;
  enemyMaxHp: number;
  enemyHpFraction: number; // de 0 a 1
  bossTimeLeft: number; // em segundos
  killsInStage: number;
  killsToBoss: number;
  autoProgress: boolean;
  canChallengeBoss: boolean;
  dayPhase: DayPhase;
  moonPhase: MoonPhase;
}

// Um nome com uma quantidade, como "Mel silvestre: 3"
export interface NamedAmount {
  id: string;
  name: string;
  amount: number;
}

export interface TrailView {
  id: string;
  name: string;
  owned: number;
  needed: number;
}

export interface ResourcesView {
  gold: number;
  roots: number;
  items: NamedAmount[];
  trails: TrailView[];
  totalKills: number;
  bossesDefeated: number;
  totalGoldEarned: number;
}

export interface StarterView {
  id: string;
  name: string;
  origin: Origin;
}

export interface PartyMemberView {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  isInParty: boolean;
  attackProgress: number; // de 0 a 1
}

export interface PartyView {
  hasStarter: boolean;
  starters: StarterView[];
  members: PartyMemberView[];
}

export interface UpgradeView {
  id: string;
  name: string;
  level: number;
  cost: number;
  isMaxed: boolean;
  canBuy: boolean;
}

export interface OfflineView {
  secondsAway: number;
  secondsSimulated: number;
  gold: number;
  xp: number;
  kills: number;
  bossesDefeated: number;
  bossesFailed: number;
  stagesAdvanced: number;
  items: NamedAmount[];
  trails: NamedAmount[];
  levelUps: NamedAmount[];
}


// =============================================================================
// =============================================================================
// S E L E T O R E S

export const selectLoopView = createStableSelector(buildLoopView);
export const selectCombatView = createStableSelector(buildCombatView);
export const selectResourcesView = createStableSelector(buildResourcesView);
export const selectPartyView = createStableSelector(buildPartyView);
export const selectUpgradeViews = createStableSelector(buildUpgradeViews);
export const selectOfflineView = createStableSelector(buildOfflineView);


// =============================================================================
// =============================================================================
// C O N S T R U Ç Ã O   D E   C A D A   V I S Ã O

// Dados que provam que o laço está rodando
function buildLoopView(snapshot: GameSnapshot): LoopView {
  return {
    tickCount: snapshot.tickCount,
    lastTickTimestamp: snapshot.lastSaveTimestamp,
    playTimeSeconds: snapshot.stats.playTimeSeconds,
    isOpenInAnotherTab: snapshot.isOpenInAnotherTab,
  };
}

// Zona, estágio, inimigo em campo e relógio do sertão
function buildCombatView(snapshot: GameSnapshot): CombatView {
  const { combat, stage } = snapshot;
  const zone = getZoneForStage(stage);
  const clock = getClockInfo(snapshot.lastSaveTimestamp);

  return {
    zoneName: zone.name,
    stage,
    maxStage: snapshot.maxStage,
    enemyName: getEnemy(combat.enemyId).name,
    isBoss: combat.isBoss,
    enemyHp: combat.enemyHp,
    enemyMaxHp: combat.enemyMaxHp,
    enemyHpFraction: combat.enemyMaxHp > 0 ? combat.enemyHp / combat.enemyMaxHp : 0,
    bossTimeLeft: combat.bossTimeLeft,
    killsInStage: snapshot.killsInStage,
    killsToBoss: zone.killsToBoss,
    autoProgress: snapshot.autoProgress,
    canChallengeBoss: canChallengeBoss(snapshot),
    dayPhase: clock.dayPhase,
    moonPhase: clock.moonPhase,
  };
}

// Patacas, Raízes, Oferendas, Rastros e totais da partida
function buildResourcesView(snapshot: GameSnapshot): ResourcesView {
  const pactEncantados = ENCANTADOS.filter((encantado) => encantado.pact !== null);

  return {
    gold: snapshot.gold,
    roots: snapshot.roots,
    items: ITEMS.map((item) => ({
      id: item.id,
      name: item.name,
      amount: snapshot.inventory[item.id] ?? 0,
    })),
    trails: pactEncantados.map((encantado) => ({
      id: encantado.id,
      name: encantado.name,
      owned: snapshot.trails[encantado.id] ?? 0,
      needed: encantado.pact?.trailsNeeded ?? 0,
    })),
    totalKills: snapshot.stats.totalKills,
    bossesDefeated: snapshot.stats.bossesDefeated,
    totalGoldEarned: snapshot.stats.totalGoldEarned,
  };
}

// Elenco com nível, XP e barra de ataque, mais as opções de encantado inicial
function buildPartyView(snapshot: GameSnapshot): PartyView {
  const owned = Object.values(snapshot.roster);
  const starters = ENCANTADOS.filter((encantado) => encantado.isStarter);

  return {
    hasStarter: owned.length > 0,
    starters: starters.map(({ id, name, origin }) => ({ id, name, origin })),
    members: owned.map((member) => ({
      id: member.id,
      name: getEncantado(member.id).name,
      level: member.level,
      xp: member.xp,
      xpToNextLevel: getXpToNextLevel(member.level),
      isInParty: snapshot.party.includes(member.id),
      attackProgress: snapshot.combat.attackProgress[member.id] ?? 0,
    })),
  };
}

// Cada melhoria com o nível atual, o custo do próximo nível e se dá para comprar
function buildUpgradeViews(snapshot: GameSnapshot): UpgradeView[] {
  return UPGRADES.map((upgrade) => {
    const level = snapshot.upgrades[upgrade.id] ?? 0;
    const cost = getUpgradeCost(upgrade, level);
    const isMaxed = isUpgradeMaxed(upgrade, level);

    return {
      id: upgrade.id,
      name: upgrade.name,
      level,
      cost,
      isMaxed,
      canBuy: !isMaxed && snapshot.gold >= cost,
    };
  });
}

// Relatório de ausência com os nomes resolvidos. Null se não há relatório aberto.
function buildOfflineView(snapshot: GameSnapshot): OfflineView | null {
  const report = snapshot.offlineReport;

  if (report === null) {
    return null;
  }

  const { summary } = report;
  const encantadoName = (id: string): string => getEncantado(id).name;

  return {
    secondsAway: report.secondsAway,
    secondsSimulated: report.secondsSimulated,
    gold: summary.gold,
    xp: summary.xp,
    kills: summary.kills,
    bossesDefeated: summary.bossesDefeated,
    bossesFailed: summary.bossesFailed,
    stagesAdvanced: summary.stagesAdvanced,
    items: toNamedAmounts(summary.items, (id) => getItem(id).name),
    trails: toNamedAmounts(summary.trails, encantadoName),
    levelUps: toNamedAmounts(summary.levelUps, encantadoName),
  };
}


// =============================================================================
// =============================================================================
// F E R R A M E N T A S

/**
 * Transforma um construtor de visão em um seletor que reaproveita o resultado.
 *
 * O React exige que um seletor devolva a mesma referência enquanto nada mudou.
 * Um seletor que monta um objeto novo a cada chamada faria o componente
 * redesenhar em todo tick, ou entrar em laço infinito. Este seletor compara o
 * resultado novo com o anterior por conteúdo e, se forem iguais, devolve o
 * anterior.
 *
 * @param build Função pura que monta a visão a partir do retrato da store.
 * @returns Seletor para usar em useGameStore(seletor).
 *
 * Caso de borda: o resultado guardado é um só por seletor. Serve porque o jogo
 * tem uma store só. Com mais de uma store, cada uma precisaria do próprio seletor.
 */
function createStableSelector<View>(
  build: (snapshot: GameSnapshot) => View,
): (snapshot: GameSnapshot) => View {
  let cached: { view: View } | null = null;

  return (snapshot) => {
    const view = build(snapshot);

    if (cached !== null && isDeepEqual(cached.view, view)) {
      return cached.view;
    }

    cached = { view };
    return view;
  };
}

// Contador { id: quantidade } -> lista com o nome de cada id
function toNamedAmounts(
  counters: Record<string, number>,
  getName: (id: string) => string,
): NamedAmount[] {
  return Object.entries(counters).map(([id, amount]) => ({ id, name: getName(id), amount }));
}
