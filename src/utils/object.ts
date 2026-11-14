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

// Compara dois valores por conteúdo, entrando em listas e objetos
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

// Mantém a referência antiga de cada campo que não mudou de conteúdo.
// Assim a interface só redesenha os painéis cujo dado mudou de verdade.
export function preserveUnchangedReferences<T extends object>(previous: T, next: T): T {
  const result = { ...next };

  for (const key of Object.keys(next) as (keyof T)[]) {
    if (isDeepEqual(previous[key], next[key])) {
      result[key] = previous[key];
    }
  }

  return result;
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
