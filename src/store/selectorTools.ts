/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/selectorTools.ts
 * O que faz: as ferramentas que todos os arquivos de seletores usam: o seletor
 * que reaproveita o resultado e a lista de nomes com quantidade.
 *
 * Quem usa: src/store/selectors.ts (clareira, juazeiro, amuletos, ajustes) e
 * src/store/expeditionSelectors.ts (expedições).
 *
 * Mapa:
 *   1. Tipos compartilhados
 *   2. Seletor estável
 *   3. Listas com nome
 */

import { isDeepEqual } from '../utils/object';
import type { GameSnapshot } from './types';

// =============================================================================
// =============================================================================
// T I P O S   C O M P A R T I L H A D O S

// Um nome com uma quantidade, como "Mel silvestre: 3"
export interface NamedAmount {
  id: string;
  name: string;
  amount: number;
}


// =============================================================================
// =============================================================================
// S E L E T O R   E S T Á V E L

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
export function createStableSelector<View>(
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


// =============================================================================
// =============================================================================
// L I S T A S   C O M   N O M E

// Contador { id: quantidade } -> lista com o nome de cada id
export function toNamedAmounts(
  counters: Record<string, number>,
  getName: (id: string) => string,
): NamedAmount[] {
  return Object.entries(counters).map(([id, amount]) => ({ id, name: getName(id), amount }));
}
