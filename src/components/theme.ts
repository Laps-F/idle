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
 */

import type { ClockView, PartyCardView, StageView } from '../store/selectors';

type Biome = StageView['biome'];
type Origin = PartyCardView['origin'];
type Rarity = PartyCardView['rarity'];
type DayPhase = ClockView['dayPhase'];
type MoonPhase = ClockView['moonPhase'];

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
