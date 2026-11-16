/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/selectors.ts
 * O que faz: prepara os dados para a tela. Cada seletor lê a store e devolve
 * um objeto simples, já com nomes resolvidos e valores calculados, pronto
 * para um componente mostrar. Assim os componentes ficam "burros": não
 * consultam dados nem fazem conta de jogo.
 *
 * Uso: const enemy = useGameStore(selectEnemyView);
 *
 * Granularidade: cada visão junta só o que muda no mesmo ritmo. A vida do
 * inimigo muda a cada golpe, o nome dele só a cada derrota, as Patacas a cada
 * derrota. Separar evita que um painel redesenhe por causa do dado de outro.
 *
 * Otimização: cada seletor guarda o último resultado e devolve a MESMA
 * referência enquanto o conteúdo não muda. O componente só redesenha quando
 * algum valor que ele mostra mudou de verdade.
 *
 * O que muda a cada tick (barra de ataque, tempo do chefe) não passa por
 * seletor de React. Fica nas funções "read", que os componentes usam com
 * refs para mexer direto no estilo, sem redesenhar.
 *
 * Mapa:
 *   1. Tipos das visões
 *   2. Seletores
 *   3. Leituras de alta frequência (para refs)
 *   4. Construção: cabeçalho, estágio e relógio
 *   5. Construção: arena
 *   6. Construção: comitiva e pactos
 *   7. Construção: melhorias e avisos
 *   8. Construção: amuletos
 *   9. Construção: ausência e escolha inicial
 *  10. Construção: visões do painel de debug
 *  11. Ferramentas
 */

import { AMULET_RARITIES, BALANCE, ENCANTADOS, ITEMS, SYNERGIES, UPGRADES } from '../data';
import { canChallengeBoss } from '../domain/actions';
import {
  canCarve,
  getBagAmulets,
  getCarveCost,
  getEffectiveBonuses,
  getSalvageValue,
  isAmuletMaxed,
} from '../domain/amulets';
import {
  getAmuletBase,
  getAmuletRarity,
  getEncantado,
  getEnemy,
  getItem,
  getZoneForStage,
} from '../domain/catalog';
import { getClockInfo, getDayPhase } from '../domain/clock';
import {
  getAttackDamage,
  getAttackInterval,
  getUpgradeCost,
  getXpToNextLevel,
  isUpgradeMaxed,
} from '../domain/formulas';
import { getModifiers } from '../domain/modifiers';
import { getPactStatus } from '../domain/pact';
import type {
  Amulet,
  BiomeId,
  DayPhase,
  ModifierStat,
  MoonPhase,
  Origin,
  Rarity,
} from '../domain/types';
import { isDeepEqual } from '../utils/object';
import type { GameSnapshot } from './types';

// =============================================================================
// =============================================================================
// T I P O S   D A S   V I S Õ E S

// Um nome com uma quantidade, como "Mel silvestre: 3"
export interface NamedAmount {
  id: string;
  name: string;
  amount: number;
}

// Cabeçalho: os recursos que a pessoa junta
export interface HeaderView {
  gold: number;
  roots: number;
  shavings: number;
  hasFoundAmulets: boolean; // os Cavacos só aparecem depois do primeiro amuleto
  items: NamedAmount[];
}

// Onde a comitiva está e o que falta para o chefe
export interface StageView {
  zoneName: string;
  biome: BiomeId;
  stage: number;
  maxStage: number;
  previousStage: number; // estágio para onde o botão "anterior" leva
  nextStage: number; // estágio para onde o botão "próximo" leva
  killsInStage: number;
  killsToBoss: number;
  killsRemaining: number; // visagens que faltam para o chefe aparecer
  isBossFight: boolean;
  autoProgress: boolean;
  canChallengeBoss: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ClockView {
  dayPhase: DayPhase;
  moonPhase: MoonPhase;
}

// Quem está em campo. Só muda quando entra outro inimigo.
export interface EnemyIdentityView {
  enemyId: string;
  name: string;
  isBoss: boolean;
}

// Vida do inimigo. Muda a cada golpe.
export interface EnemyHealthView {
  hp: number;
  maxHp: number;
  hpFraction: number; // de 0 a 1
}

// Quem ataca, para as barras de ação da arena
export interface FighterView {
  id: string;
  name: string;
  origin: Origin;
}

export interface PartyCardView {
  id: string;
  name: string;
  origin: Origin;
  rarity: Rarity;
  level: number;
  xp: number;
  xpToNextLevel: number;
  xpFraction: number; // de 0 a 1
  damagePerHit: number;
  attackInterval: number; // em segundos
  isInParty: boolean;
  canToggle: boolean; // se o botão de entrar ou sair da comitiva vale agora
}

export interface SynergyView {
  origin: Origin;
  name: string;
  description: string;
  membersInParty: number;
  membersNeeded: number;
  isActive: boolean;
}

export interface OfferingView {
  id: string;
  name: string;
  owned: number;
  needed: number;
}

export interface PactView {
  id: string;
  name: string;
  origin: Origin;
  rarity: Rarity;
  verse: string;
  isOwned: boolean;
  trailsOwned: number;
  trailsNeeded: number;
  offerings: OfferingView[];
  requiredDayPhase: DayPhase | null;
  requiredMoonPhase: MoonPhase | null;
  isClockRight: boolean;
  canSeal: boolean;
}

export interface UpgradeView {
  id: string;
  name: string;
  description: string;
  level: number;
  cost: number;
  isMaxed: boolean;
  canBuy: boolean;
}

// Contagens para os avisos das abas
export interface BadgeView {
  buyableUpgrades: number;
  sealablePacts: number;
  wearableAmulets: number; // amuletos da mochila que cabem em alguém da comitiva sem amuleto
}

// Um bônus de amuleto, já com o entalhe aplicado
export interface AmuletBonusView {
  stat: ModifierStat;
  value: number; // 0.12 = +12%
}

export interface AmuletView {
  id: string;
  baseId: string; // id do tipo, que também é o id da figura
  name: string;
  description: string;
  rarity: Rarity;
  level: number;
  maxLevel: number;
  isMaxed: boolean;
  bonuses: AmuletBonusView[]; // o primeiro é o principal
  carveCost: number; // Cavacos do próximo entalhe
  canCarve: boolean;
  salvageValue: number; // Cavacos que o desmanche rende
}

// Um encantado do elenco e o amuleto que ele veste
export interface AmuletSlotView {
  encantadoId: string;
  encantadoName: string;
  isInParty: boolean; // amuleto de quem está fora da comitiva não vale
  amulet: AmuletView | null;
}

export interface AmuletPanelView {
  shavings: number;
  bagCount: number;
  bagSize: number;
  autoSalvage: Rarity | null;
  rarities: Rarity[]; // da mais comum para a mais rara, para o seletor de desmanche automático
  slots: AmuletSlotView[];
  bag: AmuletView[];
  commonsInBag: number; // quantos comuns o desmanche em lote levaria
}

export interface StarterOptionView {
  id: string;
  name: string;
  origin: Origin;
  verse: string;
  baseAttack: number;
  attackInterval: number;
}

export interface OfflineView {
  secondsAway: number;
  secondsSimulated: number;
  wasCapped: boolean; // se a ausência passou do teto
  capSeconds: number;
  efficiency: number; // de 0 a 1
  gold: number;
  xp: number;
  kills: number;
  bossesDefeated: number;
  bossesFailed: number;
  stagesAdvanced: number;
  items: NamedAmount[];
  trails: NamedAmount[];
  levelUps: NamedAmount[];
  amuletsFound: number;
  amuletsSalvaged: number;
  shavings: number;
}

// ---------- Visões do painel de debug ----------

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
  enemyHpFraction: number;
  bossTimeLeft: number;
  killsInStage: number;
  killsToBoss: number;
  autoProgress: boolean;
  canChallengeBoss: boolean;
  dayPhase: DayPhase;
  moonPhase: MoonPhase;
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
  shavings: number;
  items: NamedAmount[];
  trails: TrailView[];
  amuletsInBag: number;
  amuletsWorn: number;
  amuletsFound: number;
  totalKills: number;
  bossesDefeated: number;
  totalGoldEarned: number;
}

export interface PartyMemberView {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  isInParty: boolean;
  attackProgress: number;
}

export interface PartyView {
  hasStarter: boolean;
  starters: StarterOptionView[];
  members: PartyMemberView[];
}


// Raridade que o botão de desmanche em lote da mochila leva embora
const BULK_SALVAGE_RARITY: Rarity = 'comum';


// =============================================================================
// =============================================================================
// S E L E T O R E S

// Interface de produção
export const selectHeaderView = createStableSelector(buildHeaderView);
export const selectStageView = createStableSelector(buildStageView);
export const selectClockView = createStableSelector(buildClockView);
export const selectEnemyIdentity = createStableSelector(buildEnemyIdentity);
export const selectEnemyHealth = createStableSelector(buildEnemyHealth);
export const selectFighters = createStableSelector(buildFighters);
export const selectPartyCards = createStableSelector(buildPartyCards);
export const selectSynergies = createStableSelector(buildSynergies);
export const selectPacts = createStableSelector(buildPacts);
export const selectUpgradeViews = createStableSelector(buildUpgradeViews);
export const selectBadges = createStableSelector(buildBadges);
export const selectAmuletPanel = createStableSelector(buildAmuletPanel);
export const selectStarterOptions = createStableSelector(buildStarterOptions);
export const selectOfflineView = createStableSelector(buildOfflineView);

// Painel de debug
export const selectLoopView = createStableSelector(buildLoopView);
export const selectCombatView = createStableSelector(buildCombatView);
export const selectResourcesView = createStableSelector(buildResourcesView);
export const selectPartyView = createStableSelector(buildPartyView);

// Seletores atômicos: devolvem um valor simples, que o Zustand compara direto
export function selectHasStarter(snapshot: GameSnapshot): boolean {
  return Object.keys(snapshot.roster).length > 0;
}

export function selectIsOpenInAnotherTab(snapshot: GameSnapshot): boolean {
  return snapshot.isOpenInAnotherTab;
}

// Texto que muda toda vez que entra um inimigo novo em campo, mesmo que seja do mesmo tipo.
// Serve de "key" no React, para a figura repetir a entrada e a barra de vida nascer cheia.
export function selectEnemySpawnKey(snapshot: GameSnapshot): string {
  const { stats, stage, combat } = snapshot;
  return `${stats.totalKills}-${stage}-${combat.isBoss ? 'chefe' : 'visagem'}`;
}

// Segundos inteiros que restam ao chefe. Muda uma vez por segundo, não a cada tick.
export function selectBossSecondsLeft(snapshot: GameSnapshot): number {
  return snapshot.combat.isBoss ? Math.ceil(snapshot.combat.bossTimeLeft) : 0;
}


// =============================================================================
// =============================================================================
// L E I T U R A S   D E   A L T A   F R E Q U Ê N C I A

// Estes valores mudam a cada tick. Não use com useGameStore(...), que redesenharia o
// componente 10 vezes por segundo. Use com o hook useStoreMeter, que escreve direto no estilo.

// Barra de ataque de um encantado, de 0 a 1
export function readAttackProgress(snapshot: GameSnapshot, encantadoId: string): number {
  return snapshot.combat.attackProgress[encantadoId] ?? 0;
}

// Quanto do tempo do chefe ainda resta, de 0 a 1. Fica em 0 sem chefe em campo.
export function readBossTimeFraction(snapshot: GameSnapshot): number {
  const { combat, stage } = snapshot;

  if (!combat.isBoss) {
    return 0;
  }

  return combat.bossTimeLeft / getZoneForStage(stage).bossTimeLimit;
}


// =============================================================================
// =============================================================================
// C A B E Ç A L H O ,   E S T Á G I O   E   R E L Ó G I O

function buildHeaderView(snapshot: GameSnapshot): HeaderView {
  return {
    gold: snapshot.gold,
    roots: snapshot.roots,
    shavings: snapshot.shavings,
    hasFoundAmulets: snapshot.stats.amuletsFound > 0,
    items: ITEMS.map((item) => ({
      id: item.id,
      name: item.name,
      amount: snapshot.inventory[item.id] ?? 0,
    })),
  };
}

function buildStageView(snapshot: GameSnapshot): StageView {
  const { stage, maxStage } = snapshot;
  const zone = getZoneForStage(stage);

  return {
    zoneName: zone.name,
    biome: zone.biome,
    stage,
    maxStage,
    previousStage: Math.max(1, stage - 1),
    nextStage: Math.min(maxStage, stage + 1),
    killsInStage: snapshot.killsInStage,
    killsToBoss: zone.killsToBoss,
    killsRemaining: Math.max(0, zone.killsToBoss - snapshot.killsInStage),
    isBossFight: snapshot.combat.isBoss,
    autoProgress: snapshot.autoProgress,
    canChallengeBoss: canChallengeBoss(snapshot),
    canGoBack: stage > 1,
    canGoForward: stage < maxStage,
  };
}

function buildClockView(snapshot: GameSnapshot): ClockView {
  const clock = getClockInfo(snapshot.lastSaveTimestamp);
  return { dayPhase: clock.dayPhase, moonPhase: clock.moonPhase };
}


// =============================================================================
// =============================================================================
// A R E N A

function buildEnemyIdentity(snapshot: GameSnapshot): EnemyIdentityView {
  const { enemyId, isBoss } = snapshot.combat;
  return { enemyId, name: getEnemy(enemyId).name, isBoss };
}

function buildEnemyHealth(snapshot: GameSnapshot): EnemyHealthView {
  const { enemyHp, enemyMaxHp } = snapshot.combat;
  return { hp: enemyHp, maxHp: enemyMaxHp, hpFraction: enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 0 };
}

function buildFighters(snapshot: GameSnapshot): FighterView[] {
  return snapshot.party.map((encantadoId) => {
    const { name, origin } = getEncantado(encantadoId);
    return { id: encantadoId, name, origin };
  });
}


// =============================================================================
// =============================================================================
// C O M I T I V A   E   P A C T O S

// Cada encantado do elenco, com o dano e o ritmo que ele tem agora
function buildPartyCards(snapshot: GameSnapshot): PartyCardView[] {
  const modifiers = getModifiers(snapshot, getDayPhase(snapshot.lastSaveTimestamp));
  const hasRoom = snapshot.party.length < BALANCE.maxPartySize;
  const canLeave = snapshot.party.length > 1;

  return Object.values(snapshot.roster).map((owned) => {
    const definition = getEncantado(owned.id);
    const xpToNextLevel = getXpToNextLevel(owned.level);
    const isInParty = snapshot.party.includes(owned.id);

    return {
      id: owned.id,
      name: definition.name,
      origin: definition.origin,
      rarity: definition.rarity,
      level: owned.level,
      xp: owned.xp,
      xpToNextLevel,
      xpFraction: xpToNextLevel > 0 ? owned.xp / xpToNextLevel : 0,
      damagePerHit: getAttackDamage(definition, owned.level, modifiers, false),
      attackInterval: getAttackInterval(definition, modifiers),
      isInParty,
      canToggle: isInParty ? canLeave : hasRoom,
    };
  });
}

// Todas as sinergias, com quantos da origem estão na comitiva e se o bônus está valendo
function buildSynergies(snapshot: GameSnapshot): SynergyView[] {
  const dayPhase = getDayPhase(snapshot.lastSaveTimestamp);
  const partyOrigins = snapshot.party.map((encantadoId) => getEncantado(encantadoId).origin);

  return SYNERGIES.map((synergy) => {
    const membersInParty = partyOrigins.filter((origin) => origin === synergy.origin).length;
    const isPhaseRight = synergy.dayPhase === undefined || synergy.dayPhase === dayPhase;

    return {
      origin: synergy.origin,
      name: synergy.name,
      description: synergy.description,
      membersInParty,
      membersNeeded: synergy.membersNeeded,
      isActive: membersInParty >= synergy.membersNeeded && isPhaseRight,
    };
  });
}

// Encantados que entram por pacto, com o que falta para cada um
function buildPacts(snapshot: GameSnapshot): PactView[] {
  const pactEncantados = ENCANTADOS.filter((encantado) => encantado.pact !== null);

  return pactEncantados.map((encantado) => {
    const status = getPactStatus(snapshot, encantado.id, snapshot.lastSaveTimestamp);

    return {
      id: encantado.id,
      name: encantado.name,
      origin: encantado.origin,
      rarity: encantado.rarity,
      verse: encantado.verse,
      isOwned: status.isOwned,
      trailsOwned: Math.min(status.trailsOwned, status.trailsNeeded),
      trailsNeeded: status.trailsNeeded,
      offerings: status.offerings.map((offering) => ({
        id: offering.itemId,
        name: getItem(offering.itemId).name,
        owned: offering.owned,
        needed: offering.needed,
      })),
      requiredDayPhase: encantado.pact?.dayPhase ?? null,
      requiredMoonPhase: encantado.pact?.moonPhase ?? null,
      isClockRight: status.isClockRight,
      canSeal: status.canSeal,
    };
  });
}


// =============================================================================
// =============================================================================
// M E L H O R I A S   E   A V I S O S

// Cada melhoria com o nível atual, o custo do próximo nível e se dá para comprar
function buildUpgradeViews(snapshot: GameSnapshot): UpgradeView[] {
  return UPGRADES.map((upgrade) => {
    const level = snapshot.upgrades[upgrade.id] ?? 0;
    const cost = getUpgradeCost(upgrade, level);
    const isMaxed = isUpgradeMaxed(upgrade, level);

    return {
      id: upgrade.id,
      name: upgrade.name,
      description: upgrade.description,
      level,
      cost,
      isMaxed,
      canBuy: !isMaxed && snapshot.gold >= cost,
    };
  });
}

// Quantas melhorias dá para comprar e quantos pactos dá para fechar agora
function buildBadges(snapshot: GameSnapshot): BadgeView {
  return {
    buyableUpgrades: buildUpgradeViews(snapshot).filter((upgrade) => upgrade.canBuy).length,
    sealablePacts: buildPacts(snapshot).filter((pact) => pact.canSeal).length,
    wearableAmulets: countWearableAmulets(snapshot),
  };
}

// Quantos amuletos da mochila já poderiam estar vestidos: um por encantado da comitiva sem amuleto
function countWearableAmulets(snapshot: GameSnapshot): number {
  const emptySlots = snapshot.party.filter((encantadoId) => !(encantadoId in snapshot.equipped));
  return Math.min(emptySlots.length, getBagAmulets(snapshot).length);
}


// =============================================================================
// =============================================================================
// A M U L E T O S

// Tudo que a aba de amuletos mostra: Cavacos, quem veste o quê e a mochila
function buildAmuletPanel(snapshot: GameSnapshot): AmuletPanelView {
  const bag = getBagAmulets(snapshot);
  const toView = (amulet: Amulet): AmuletView => buildAmuletView(snapshot, amulet);

  return {
    shavings: snapshot.shavings,
    bagCount: bag.length,
    bagSize: BALANCE.amuletBagSize,
    autoSalvage: snapshot.autoSalvage,
    rarities: AMULET_RARITIES.map((definition) => definition.rarity),
    slots: Object.keys(snapshot.roster).map((encantadoId) => {
      const amuletId = snapshot.equipped[encantadoId];
      const amulet = amuletId === undefined ? undefined : snapshot.amulets[amuletId];

      return {
        encantadoId,
        encantadoName: getEncantado(encantadoId).name,
        isInParty: snapshot.party.includes(encantadoId),
        amulet: amulet === undefined ? null : toView(amulet),
      };
    }),
    bag: bag.map(toView),
    commonsInBag: bag.filter((amulet) => amulet.rarity === BULK_SALVAGE_RARITY).length,
  };
}

// Um amuleto pronto para mostrar: nome, bônus com entalhe, custo e valor de desmanche
function buildAmuletView(snapshot: GameSnapshot, amulet: Amulet): AmuletView {
  const base = getAmuletBase(amulet.baseId);

  return {
    id: amulet.id,
    baseId: amulet.baseId,
    name: base.name,
    description: base.description,
    rarity: amulet.rarity,
    level: amulet.level,
    maxLevel: getAmuletRarity(amulet.rarity).maxLevel,
    isMaxed: isAmuletMaxed(amulet),
    bonuses: getEffectiveBonuses(amulet),
    carveCost: getCarveCost(amulet),
    canCarve: canCarve(snapshot, amulet.id),
    salvageValue: getSalvageValue(amulet),
  };
}


// =============================================================================
// =============================================================================
// A U S Ê N C I A   E   E S C O L H A   I N I C I A L

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
    wasCapped: report.secondsAway > BALANCE.offlineCapSeconds,
    capSeconds: BALANCE.offlineCapSeconds,
    efficiency: BALANCE.offlineEfficiency,
    gold: summary.gold,
    xp: summary.xp,
    kills: summary.kills,
    bossesDefeated: summary.bossesDefeated,
    bossesFailed: summary.bossesFailed,
    stagesAdvanced: summary.stagesAdvanced,
    items: toNamedAmounts(summary.items, (id) => getItem(id).name),
    trails: toNamedAmounts(summary.trails, encantadoName),
    levelUps: toNamedAmounts(summary.levelUps, encantadoName),
    amuletsFound: summary.amuletsFound,
    amuletsSalvaged: summary.amuletsSalvaged,
    shavings: summary.shavings,
  };
}

// Encantados que podem ser escolhidos para começar
function buildStarterOptions(): StarterOptionView[] {
  return ENCANTADOS.filter((encantado) => encantado.isStarter).map((encantado) => ({
    id: encantado.id,
    name: encantado.name,
    origin: encantado.origin,
    verse: encantado.verse,
    baseAttack: encantado.baseAttack,
    attackInterval: encantado.attackInterval,
  }));
}


// =============================================================================
// =============================================================================
// V I S Õ E S   D O   P A I N E L   D E   D E B U G

// Dados que provam que o laço está rodando
function buildLoopView(snapshot: GameSnapshot): LoopView {
  return {
    tickCount: snapshot.tickCount,
    lastTickTimestamp: snapshot.lastSaveTimestamp,
    playTimeSeconds: snapshot.stats.playTimeSeconds,
    isOpenInAnotherTab: snapshot.isOpenInAnotherTab,
  };
}

// Zona, estágio, inimigo em campo e relógio do sertão, tudo junto
function buildCombatView(snapshot: GameSnapshot): CombatView {
  const stage = buildStageView(snapshot);
  const enemy = buildEnemyIdentity(snapshot);
  const health = buildEnemyHealth(snapshot);
  const clock = buildClockView(snapshot);

  return {
    zoneName: stage.zoneName,
    stage: stage.stage,
    maxStage: stage.maxStage,
    enemyName: enemy.name,
    isBoss: enemy.isBoss,
    enemyHp: health.hp,
    enemyMaxHp: health.maxHp,
    enemyHpFraction: health.hpFraction,
    bossTimeLeft: snapshot.combat.bossTimeLeft,
    killsInStage: stage.killsInStage,
    killsToBoss: stage.killsToBoss,
    autoProgress: stage.autoProgress,
    canChallengeBoss: stage.canChallengeBoss,
    dayPhase: clock.dayPhase,
    moonPhase: clock.moonPhase,
  };
}

// Patacas, Raízes, Oferendas, Rastros e totais da partida
function buildResourcesView(snapshot: GameSnapshot): ResourcesView {
  const header = buildHeaderView(snapshot);

  return {
    gold: header.gold,
    roots: header.roots,
    shavings: header.shavings,
    items: header.items,
    trails: buildPacts(snapshot).map((pact) => ({
      id: pact.id,
      name: pact.name,
      owned: snapshot.trails[pact.id] ?? 0,
      needed: pact.trailsNeeded,
    })),
    amuletsInBag: getBagAmulets(snapshot).length,
    amuletsWorn: Object.keys(snapshot.equipped).length,
    amuletsFound: snapshot.stats.amuletsFound,
    totalKills: snapshot.stats.totalKills,
    bossesDefeated: snapshot.stats.bossesDefeated,
    totalGoldEarned: snapshot.stats.totalGoldEarned,
  };
}

// Elenco com nível, XP e barra de ataque, mais as opções de encantado inicial
function buildPartyView(snapshot: GameSnapshot): PartyView {
  return {
    hasStarter: selectHasStarter(snapshot),
    starters: buildStarterOptions(),
    members: buildPartyCards(snapshot).map((card) => ({
      id: card.id,
      name: card.name,
      level: card.level,
      xp: card.xp,
      xpToNextLevel: card.xpToNextLevel,
      isInParty: card.isInParty,
      attackProgress: readAttackProgress(snapshot, card.id),
    })),
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
