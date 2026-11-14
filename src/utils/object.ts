/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/utils/object.ts
 * O que faz: ferramentas para comparar e conferir objetos simples
 * (só números, textos, booleanos, listas e objetos).
 */

// =============================================================================
// =============================================================================
// O B J E T O S

// Verdadeiro para objeto comum, falso para null, lista e valores simples
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Compara dois valores por conteúdo, entrando em listas e objetos.
 *
 * @param first Primeiro valor.
 * @param second Segundo valor.
 * @returns true se os dois têm o mesmo conteúdo.
 *
 * Casos de borda: NaN é igual a NaN e +0 é diferente de -0 (regra do Object.is).
 * Lista nunca é igual a objeto. Não trata Date, Map, Set nem referências circulares,
 * que não existem no estado do jogo.
 */
export function isDeepEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) {
    return true;
  }
  if (Array.isArray(first) && Array.isArray(second)) {
    return areArraysEqual(first, second);
  }
  if (isRecord(first) && isRecord(second)) {
    return areRecordsEqual(first, second);
  }
  return false;
}

/**
 * Monta um objeto com os valores de "next", mas reaproveitando de "previous" a
 * referência de cada campo cujo conteúdo não mudou.
 *
 * O React e o Zustand comparam por referência. Sem isso, um estado recriado por
 * inteiro faria todos os painéis redesenharem a cada tick, mesmo os que mostram
 * dados que não mudaram.
 *
 * @param previous Objeto antigo. Não é alterado.
 * @param next Objeto novo. Não é alterado.
 * @returns Objeto novo com os campos de "next". Só o primeiro nível é analisado.
 *
 * Caso de borda: campo que existe só em "previous" fica de fora do resultado.
 */
export function preserveUnchangedReferences<T extends object>(previous: T, next: T): T {
  const result: T = { ...next };

  for (const key of getOwnKeys(next)) {
    if (isDeepEqual(previous[key], next[key])) {
      result[key] = previous[key];
    }
  }

  return result;
}

// Chaves do objeto com o tipo certo. O Object.keys devolve string[] e perde essa informação.
function getOwnKeys<T extends object>(value: T): (keyof T)[] {
  return Object.keys(value).filter((key): key is Extract<keyof T, string> => key in value);
}

// Compara duas listas, posição por posição
function areArraysEqual(first: unknown[], second: unknown[]): boolean {
  if (first.length !== second.length) {
    return false;
  }
  return first.every((value, index) => isDeepEqual(value, second[index]));
}

// Compara dois objetos, campo por campo
function areRecordsEqual(first: Record<string, unknown>, second: Record<string, unknown>): boolean {
  const firstKeys = Object.keys(first);

  if (firstKeys.length !== Object.keys(second).length) {
    return false;
  }
  return firstKeys.every((key) => key in second && isDeepEqual(first[key], second[key]));
}
