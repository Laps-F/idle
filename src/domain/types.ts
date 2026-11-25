/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/types.ts
 * O que faz: reúne as entidades e tipagens do jogo. Não tem lógica.
 * Os arquivos de src/data importam daqui só os tipos, para tipar os dados.
 *
 * Mapa:
 *   1. Tipos básicos
 *   2. Definições (o formato dos arquivos de src/data), incluindo os amuletos
 *   3. Estado salvo (o que vai para o localStorage)
 *   4. Resultados da simulação (resumos, relatório offline e eventos)
 */

// =============================================================================
// =============================================================================
// T I P O S   B Á S I C O S

export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';
export type Origin = 'mata' | 'agua' | 'fogo' | 'vento' | 'noite';
export type DayPhase = 'dia' | 'noite';
export type MoonPhase = 'nova' | 'crescente' | 'cheia' | 'minguante';
export type BiomeId =
  | 'mata-atlantica'
  | 'cerrado'
  | 'caatinga'
  | 'pantanal'
  | 'amazonia'
  | 'pampa';

// Tudo que uma melhoria ou sinergia pode alterar
export type ModifierStat =
  | 'damage'
  | 'bossDamage'
  | 'attackSpeed'
  | 'gold'
  | 'dropChance'
  | 'critChance';

// Valores finais já calculados. critChance é probabilidade (0 a 1), o resto é multiplicador.
// Soma de bônus por atributo, antes de virar multiplicador
export type StatBonuses = Record<ModifierStat, number>;

// Multiplicadores finais que o combate usa. Além dos atributos, as chances de
// Rastro, de Oferenda e de amuleto, que partem da chance de achado e ganham os
// bônus próprios do juazeiro.
export type Modifiers = StatBonuses & {
  trailChance: number;
  itemChance: number;
  amuletChance: number;
};


// =============================================================================
// =============================================================================
// D E F I N I Ç Õ E S

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
}

export interface DropEntry {
  itemId: string;
  chance: number; // de 0 a 1
  min: number;
  max: number;
}

// Condição de hora e de lua. Campo ausente quer dizer "tanto faz".
export interface ClockRequirement {
  dayPhase?: DayPhase;
  moonPhase?: MoonPhase;
}

export interface OfferingCost {
  itemId: string;
  amount: number;
}

export interface PactRequirement extends ClockRequirement {
  trailsNeeded: number;
  offerings: OfferingCost[];
}

export interface EncantadoDef {
  id: string;
  name: string;
  origin: Origin;
  rarity: Rarity;
  baseAttack: number;
  attackInterval: number; // em segundos
  isStarter: boolean;
  pact: PactRequirement | null; // null para os iniciais, que não precisam de pacto
  verse: string; // quadra de cordel do Almanaque
}

export interface EnemyDef {
  id: string;
  name: string;
  hpMultiplier: number;
  goldMultiplier: number;
  xpMultiplier: number;
  drops: DropEntry[];
}

// Encantado que deixa Rastros numa zona
export interface EncounterDef extends ClockRequirement {
  encantadoId: string;
  trailChance: number; // de 0 a 1, por visagem derrotada
}

export interface ZoneDef {
  id: string;
  biome: BiomeId;
  name: string;
  stageCount: number;
  enemyIds: string[];
  bossId: string;
  killsToBoss: number;
  bossTimeLimit: number; // em segundos
  encounters: EncounterDef[];
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costFactor: number;
  stat: ModifierStat;
  bonusPerLevel: number;
  maxLevel?: number;
}

export interface SynergyDef {
  origin: Origin;
  name: string;
  description: string;
  membersNeeded: number;
  stat: ModifierStat;
  bonus: number;
  dayPhase?: DayPhase; // quando presente, a sinergia só vale nessa fase do dia
}


// ---------- Juazeiro (Rebrota) ----------

// Os três galhos do juazeiro
export type JuazeiroBranch = 'forca' | 'vento' | 'lua';

// O que um nó do juazeiro altera
export type JuazeiroEffect =
  | 'damage' // +fração de dano
  | 'bossDamage' // +fração de dano contra chefes
  | 'critChance' // +chance de crítico (soma)
  | 'bossTime' // +segundos no tempo do chefe
  | 'startStage' // estágios à frente no começo de cada edição
  | 'startGold' // níveis de Patacas iniciais em cada edição
  | 'autoBuy' // 1 libera a compra automática de melhorias
  | 'offlineEfficiency' // +eficiência da ausência (soma)
  | 'offlineCap' // +segundos no teto da ausência
  | 'trailChance' // +fração de chance de Rastro
  | 'itemChance' // +fração de chance de Oferenda
  | 'amuletChance' // +fração de chance de amuleto
  | 'bagSize'; // +vagas na mochila de amuletos

// Um galho do juazeiro: nome e ideia
export interface JuazeiroBranchDef {
  id: JuazeiroBranch;
  name: string;
  description: string;
}

// Um nó do juazeiro. Custo do próximo nível = costBase + costStep × nível atual.
export interface JuazeiroNodeDef {
  id: string;
  branch: JuazeiroBranch;
  name: string;
  description: string; // efeito de um nível, em texto
  effect: JuazeiroEffect;
  valuePerLevel: number;
  maxLevel: number;
  costBase: number; // Raízes do primeiro nível
  costStep: number; // quanto o custo sobe a cada nível
}

// ---------- Amuletos ----------

// Tipo de amuleto: o que ele é e qual atributo fortalece
export interface AmuletBaseDef {
  id: string;
  name: string;
  description: string;
  stat: ModifierStat;
  baseBonus: number; // bônus de um amuleto comum, no estágio 1, sem entalhe (0.12 = +12%)
}

// Linha da tabela de raridades dos amuletos
export interface AmuletRarityDef {
  rarity: Rarity;
  weight: number; // peso no sorteio da raridade. Quanto maior, mais comum.
  bonusMultiplier: number; // multiplica todos os bônus do amuleto
  extraBonuses: number; // quantos bônus secundários o amuleto ganha ao ser gerado
  maxLevel: number; // até que nível o entalhe vai
  salvageValue: number; // Cavacos que o desmanche rende no estágio 1
  carveCostMultiplier: number; // multiplica o custo de cada entalhe
}

// Um bônus de um amuleto, já sorteado
export interface AmuletBonus {
  stat: ModifierStat;
  value: number; // valor sem entalhe (0.12 = +12%)
}

// Um amuleto que a pessoa encontrou. Os bônus são sorteados na hora da queda e não mudam mais.
export interface Amulet {
  id: string;
  baseId: string;
  rarity: Rarity;
  foundAtStage: number; // estágio em que caiu. Entra no valor do desmanche.
  level: number; // nível de entalhe, a partir de 0
  bonuses: AmuletBonus[]; // o primeiro é o bônus principal, os outros são secundários
}


// =============================================================================
// =============================================================================
// E S T A D O   S A L V O

export interface OwnedEncantado {
  id: string;
  level: number;
  xp: number;
  bond: number;
}

export interface CombatState {
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  isBoss: boolean;
  bossTimeLeft: number; // em segundos. Fica em 0 quando não é chefe.
  attackProgress: Record<string, number>; // de 0 a 1 por encantado da comitiva
}

export interface GameStats {
  totalKills: number;
  totalGoldEarned: number;
  bossesDefeated: number;
  playTimeSeconds: number;
  amuletsFound: number;
  bossesFailed: number; // chefes que escaparam por tempo. O primeiro revela o juazeiro.
}

export interface GameState {
  version: number;
  gold: number; // Patacas
  stage: number; // estágio atual. A zona é calculada a partir dele.
  maxStage: number; // maior estágio já liberado
  killsInStage: number;
  autoProgress: boolean;
  party: string[]; // ids da comitiva
  roster: Record<string, OwnedEncantado>;
  trails: Record<string, number>; // Rastros por encantado
  inventory: Record<string, number>; // Oferendas por item
  upgrades: Record<string, number>; // nível de cada melhoria
  roots: number; // Raízes fincadas: todas as ganhas na Rebrota. Cada uma dá bônus para sempre.
  juazeiro: Record<string, number>; // nível de cada nó do juazeiro
  edition: number; // edição do folheto: 1 no começo, +1 a cada Rebrota
  recordStage: number; // maior estágio liberado em edições anteriores (0 antes da 1ª Rebrota)
  editionSeconds: number; // tempo de jogo da edição atual
  autoBuy: boolean; // compra automática de melhorias ligada (só vale com o nó "Mão ligeira")
  amulets: Record<string, Amulet>; // todos os amuletos da pessoa, vestidos ou na mochila
  equipped: Record<string, string>; // quem veste o quê: id do encantado -> id do amuleto
  shavings: number; // Cavacos, que o desmanche rende e o entalhe gasta
  autoSalvage: Rarity | null; // desmancha sozinho os amuletos até esta raridade. Null desliga.
  nextAmuletNumber: number; // contador que dá um id único a cada amuleto encontrado
  combat: CombatState;
  lastSaveTimestamp: number; // instante (ms) até onde o estado já foi simulado
  stats: GameStats;
}


// =============================================================================
// =============================================================================
// R E S U L T A D O S   D A   S I M U L A Ç Ã O

// Tudo que aconteceu num trecho simulado
export interface SimulationSummary {
  seconds: number;
  gold: number;
  xp: number; // XP que cada encantado da comitiva recebeu
  kills: number;
  bossesDefeated: number;
  bossesFailed: number;
  stagesAdvanced: number;
  items: Record<string, number>;
  trails: Record<string, number>;
  levelUps: Record<string, number>;
  amuletsFound: number; // amuletos que caíram, guardados ou desmanchados
  amuletsSalvaged: number; // quantos deles foram desmanchados na hora
  shavings: number; // Cavacos rendidos por esses desmanches
}

export interface OfflineReport {
  secondsAway: number; // tempo real fora do jogo
  secondsSimulated: number; // tempo que rendeu, depois do teto e da eficiência
  capSeconds: number; // teto da ausência que valeu (o juazeiro pode aumentar)
  efficiency: number; // eficiência que valeu, de 0 a 1
  summary: SimulationSummary;
}

// O que uma simulação devolve: o estado novo, o resumo e os eventos (quando pedidos)
export interface SimulationResult {
  state: GameState;
  summary: SimulationSummary;
  events: CombatEvent[];
}

// O que o cálculo de ausência devolve. O relatório é null quando não havia comitiva.
export interface OfflineResult {
  state: GameState;
  report: OfflineReport | null;
}

// Eventos para a interface desenhar dano flutuante, registro de combate e avisos
export type CombatEvent =
  | { type: 'hit'; attackerId: string; damage: number; isCrit: boolean }
  | { type: 'kill'; enemyId: string; isBoss: boolean; gold: number; xp: number }
  | { type: 'drop'; itemId: string; amount: number }
  | { type: 'trail'; encantadoId: string }
  | { type: 'amulet'; baseId: string; rarity: Rarity; wasSalvaged: boolean; shavings: number }
  | { type: 'levelUp'; encantadoId: string; level: number }
  | { type: 'bossAppeared'; enemyId: string }
  | { type: 'bossFailed'; enemyId: string }
  | { type: 'stageAdvanced'; stage: number }
  | { type: 'rebrota'; edition: number; roots: number };
