/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/domain/types.ts
 * O que faz: reúne as entidades e tipagens do jogo. Não tem lógica.
 * Os arquivos de src/data importam daqui só os tipos, para tipar os dados.
 *
 * Mapa:
 *   1. Tipos básicos
 *   2. Definições (o formato dos arquivos de src/data)
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
export type Modifiers = Record<ModifierStat, number>;


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
  roots: number; // Raízes, a moeda da Rebrota
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
}

export interface OfflineReport {
  secondsAway: number; // tempo real fora do jogo
  secondsSimulated: number; // tempo que rendeu, depois do teto e da eficiência
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
  | { type: 'levelUp'; encantadoId: string; level: number }
  | { type: 'bossAppeared'; enemyId: string }
  | { type: 'bossFailed'; enemyId: string }
  | { type: 'stageAdvanced'; stage: number };
