/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/theme.ts
 * O que faz: guarda as escolhas de apresentação que dependem de um dado do
 * jogo: a cor do papel de cada bioma e os textos de origem, raridade, fase do
 * dia e lua. É só aparência. Nenhuma regra de jogo mora aqui.
 *
 * Mapa:
 *   1. Papel da capa por bioma
 *   2. Textos
 *   3. Amuletos: carimbo de raridade e textos
 */

import type {
  AmuletBonusView,
  ClockView,
  PartyCardView,
  StageView,
} from '../store/selectors';

type Biome = StageView['biome'];
type Origin = PartyCardView['origin'];
type Rarity = PartyCardView['rarity'];
type DayPhase = ClockView['dayPhase'];
type MoonPhase = ClockView['moonPhase'];
type BonusStat = AmuletBonusView['stat'];

// =============================================================================
// =============================================================================
// P A P E L   D A   C A P A   P O R   B I O M A

// Cordel é impresso em papel colorido barato: verde, amarelo, rosa, azul.
// Cada bioma tem o seu, e a xilogravura vai sempre em tinta preta por cima.
export const COVER_PAPER: Record<Biome, string> = {
  'mata-atlantica': '#a9d3a0',
  cerrado: '#f0cf6a',
  caatinga: '#f2a98e',
  pantanal: '#9fcbe2',
  amazonia: '#7fbf92',
  pampa: '#cdbbe3',
};

// À noite o mesmo papel escurece em direção ao anil
export const NIGHT_COVER_MIX = 'color-mix(in srgb, var(--capa-dia) 62%, #2c3e6b)';


// =============================================================================
// =============================================================================
// T E X T O S

export const ORIGIN_LABELS: Record<Origin, string> = {
  mata: 'Mata',
  agua: 'Água',
  fogo: 'Fogo',
  vento: 'Vento',
  noite: 'Noite',
};

export const RARITY_LABELS: Record<Rarity, string> = {
  comum: 'Comum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
};

export const DAY_PHASE_LABELS: Record<DayPhase, string> = {
  dia: 'Dia',
  noite: 'Noite',
};

export const MOON_PHASE_LABELS: Record<MoonPhase, string> = {
  nova: 'lua nova',
  crescente: 'lua crescente',
  cheia: 'lua cheia',
  minguante: 'lua minguante',
};


// =============================================================================
// =============================================================================
// A M U L E T O S

// Carimbo de raridade: do papel mais apagado ao ouro sobre tinta
export const RARITY_STAMP_CLASSES: Record<Rarity, string> = {
  comum: 'bg-jornal-escuro text-tinta',
  raro: 'bg-anil text-jornal',
  epico: 'bg-urucum text-jornal',
  lendario: 'bg-tinta text-ouro',
};

// Como cada bônus é lido depois do número: "+12% de dano"
export const BONUS_LABELS: Record<BonusStat, string> = {
  damage: 'de dano',
  bossDamage: 'de dano em chefes',
  attackSpeed: 'de velocidade de ataque',
  gold: 'de Patacas',
  dropChance: 'de chance de achado',
  critChance: 'de chance de crítico',
};

// Opções do desmanche automático: até que raridade ele leva
export const AUTO_SALVAGE_LABELS: Record<Rarity, string> = {
  comum: 'Só os comuns',
  raro: 'Comuns e raros',
  epico: 'Até os épicos',
  lendario: 'Todos, até os lendários',
};

export const AUTO_SALVAGE_OFF_LABEL = 'Nunca';
