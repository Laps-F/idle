/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/utils/random.ts
 * O que faz: sorteios. Toda função recebe a fonte de números aleatórios em
 * vez de chamar o Math.random por conta própria. Com a mesma fonte, o
 * resultado é sempre o mesmo, o que mantém as funções puras e testáveis.
 */

// =============================================================================
// =============================================================================
// T I P O S

// Função que devolve um número em [0, 1), como o Math.random
export type RandomSource = () => number;


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

/**
 * Sorteia um elemento da lista.
 *
 * @param options Lista de onde sortear. Precisa ter pelo menos um elemento.
 * @param random Fonte de números aleatórios.
 * @returns Um dos elementos da lista.
 * @throws Error se a lista estiver vazia, porque não há o que devolver.
 */
export function pickRandom<T>(options: readonly T[], random: RandomSource): T {
  const index = Math.min(Math.floor(random() * options.length), options.length - 1);
  const picked = options[index];

  if (picked === undefined) {
    throw new Error('pickRandom recebeu uma lista vazia.');
  }

  return picked;
}

/**
 * Sorteia um elemento respeitando os pesos: peso 3 sai três vezes mais que peso 1.
 *
 * @param options Lista de onde sortear. Cada elemento informa o próprio peso.
 * @param random Fonte de números aleatórios.
 * @returns Um dos elementos da lista.
 * @throws Error se a lista estiver vazia ou se a soma dos pesos não for positiva.
 *
 * Caso de borda: elemento com peso zero ou negativo nunca é sorteado.
 */
export function pickWeighted<T extends { weight: number }>(
  options: readonly T[],
  random: RandomSource,
): T {
  const candidates = options.filter((option) => option.weight > 0);
  const totalWeight = candidates.reduce((sum, option) => sum + option.weight, 0);
  let remaining = random() * totalWeight;

  for (const candidate of candidates) {
    remaining -= candidate.weight;
    if (remaining < 0) {
      return candidate;
    }
  }

  // Só chega aqui por arredondamento na última fatia, ou com a lista vazia
  const lastCandidate = candidates[candidates.length - 1];

  if (lastCandidate === undefined) {
    throw new Error('pickWeighted recebeu uma lista sem nenhum peso positivo.');
  }

  return lastCandidate;
}

/**
 * Cria um gerador com semente (algoritmo mulberry32).
 *
 * Serve para repetir uma simulação: a mesma semente devolve sempre a mesma
 * sequência. Não é seguro para criptografia.
 *
 * @param seed Semente. Só os 32 bits inteiros são usados (1.9 e 1 dão a mesma sequência).
 * @returns Função que devolve um número em [0, 1) a cada chamada.
 */
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
