/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/items.ts
 * O que faz: lista as Oferendas, os itens que as visagens deixam cair e que
 * os encantados pedem para fechar um pacto.
 */

import type { ItemDef } from '../types/game';

// =============================================================================
// =============================================================================
// O F E R E N D A S

export const ITEMS: ItemDef[] = [
  {
    id: 'mel-silvestre',
    name: 'Mel silvestre',
    description: 'Favo colhido em oco de árvore. A Caipora não resiste.',
    rarity: 'comum',
  },
  {
    id: 'cipo-trancado',
    name: 'Cipó trançado',
    description: 'Cipó firme, bom para amarrar promessa e segurar fogo.',
    rarity: 'comum',
  },
  {
    id: 'brasa-viva',
    name: 'Brasa viva',
    description: 'Sobra acesa do Corpo-Seco. Não apaga nem debaixo de chuva.',
    rarity: 'raro',
  },
];
