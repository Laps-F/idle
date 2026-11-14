/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/encantados.ts
 * O que faz: lista os encantados que entram na comitiva.
 * Os iniciais são escolhidos no começo. Os outros entram por pacto.
 *
 * Mapa:
 *   1. Iniciais
 *   2. Conquistados por pacto
 *   3. Lista completa
 */

import type { EncantadoDef } from '../domain/types';

// =============================================================================
// =============================================================================
// I N I C I A I S

const STARTERS: EncantadoDef[] = [
  {
    id: 'saci',
    name: 'Saci',
    origin: 'vento',
    rarity: 'comum',
    baseAttack: 3,
    attackInterval: 1,
    isStarter: true,
    pact: null,
    verse: [
      'Num pé só, de vento e riso,',
      'roda, some e dá um nó.',
      'Quem persegue perde o siso,',
      'quem faz graça não anda só.',
    ].join('\n'),
  },
  {
    id: 'curupira',
    name: 'Curupira',
    origin: 'mata',
    rarity: 'comum',
    baseAttack: 6,
    attackInterval: 1.8,
    isStarter: true,
    pact: null,
    verse: [
      'Pé virado engana o rastro',
      'de quem entra pra ferir.',
      'Quem respeita acha o lastro',
      'do caminho pra sair.',
    ].join('\n'),
  },
  {
    id: 'iara',
    name: 'Iara',
    origin: 'agua',
    rarity: 'comum',
    baseAttack: 4.5,
    attackInterval: 1.4,
    isStarter: true,
    pact: null,
    verse: [
      'Canta a Iara, o rio escuta,',
      'prata fina vem do fundo.',
      'Quem não teme a água bruta',
      'carrega o brilho do mundo.',
    ].join('\n'),
  },
];


// =============================================================================
// =============================================================================
// C O N Q U I S T A D O S   P O R   P A C T O

const PACT_ENCANTADOS: EncantadoDef[] = [
  {
    id: 'caipora',
    name: 'Caipora',
    origin: 'mata',
    rarity: 'raro',
    baseAttack: 9,
    attackInterval: 1.6,
    isStarter: false,
    pact: {
      trailsNeeded: 3,
      offerings: [{ itemId: 'mel-silvestre', amount: 5 }],
    },
    verse: [
      'Montada em porco-do-mato,',
      'conta os bichos, um a um.',
      'Deixe mel no pé do mato',
      'e não falta amparo algum.',
    ].join('\n'),
  },
  {
    id: 'boitata',
    name: 'Boitatá',
    origin: 'fogo',
    rarity: 'epico',
    baseAttack: 22,
    attackInterval: 2.4,
    isStarter: false,
    pact: {
      trailsNeeded: 5,
      offerings: [
        { itemId: 'brasa-viva', amount: 3 },
        { itemId: 'cipo-trancado', amount: 8 },
      ],
      dayPhase: 'noite',
    },
    verse: [
      'Cobra de fogo na campina,',
      'olho aceso noite afora.',
      'Queima só quem desatina',
      'e põe fogo fora de hora.',
    ].join('\n'),
  },
];


// =============================================================================
// =============================================================================
// L I S T A   C O M P L E T A

export const ENCANTADOS: EncantadoDef[] = [...STARTERS, ...PACT_ENCANTADOS];
