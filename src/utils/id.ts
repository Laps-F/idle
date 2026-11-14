/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/utils/id.ts
 * O que faz: gera identificadores únicos. O horário e o sorteio entram por
 * parâmetro, para a função continuar pura.
 */

import type { RandomSource } from './random';

// =============================================================================
// =============================================================================
// I D E N T I F I C A D O R E S

// Base 36 usa dígitos e letras, o que deixa o trecho sorteado curto
const RANDOM_PART_RADIX = 36;

// Identificador do tipo "1731623456789-k3f9x2": instante em ms mais um trecho sorteado
export function createUniqueId(timestamp: number, random: RandomSource): string {
  const randomPart = random().toString(RANDOM_PART_RADIX).slice(2);
  return `${timestamp}-${randomPart}`;
}
