/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/utils/random.ts
 * O que faz: sorteios do jogo. Toda função recebe a fonte de números
 * aleatórios, o que permite repetir uma simulação nos testes.
 */

import type { RandomSource } from '../types/game';

// =============================================================================
// =============================================================================
// S O R T E I O S

// Verdadeiro com a probabilidade pedida (de 0 a 1)
export function rollChance(chance: number, random: RandomSource): boolean {
  return random() < chance;
}

// Inteiro entre min e max, incluindo os dois
export function randomInteger(min: number, max: number, random: RandomSource): number {
  const optionCount = max - min + 1;
  return min + Math.floor(random() * optionCount);
}

// Um elemento qualquer da lista
export function pickRandom<T>(options: readonly T[], random: RandomSource): T {
  const index = Math.floor(random() * options.length);
  return options[Math.min(index, options.length - 1)];
}

// Gerador com semente (mulberry32): a mesma semente devolve sempre a mesma sequência
export function createSeededRandom(seed: number): RandomSource {
  let current = seed >>> 0;

  return () => {
    current = (current + 0x6d2b79f5) >>> 0;
    let mixed = current;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
