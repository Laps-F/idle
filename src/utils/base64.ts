/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/utils/base64.ts
 * O que faz: converte texto para Base64 e de volta, aceitando acentos.
 * O btoa sozinho quebra com "ç" e "ã", por isso o texto passa por UTF-8 antes.
 */

// =============================================================================
// =============================================================================
// B A S E 6 4

// Texto comum -> Base64
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

// Base64 -> texto comum. Lança erro se o código não for Base64 válido.
export function decodeBase64(code: string): string {
  const binary = atob(code.trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
