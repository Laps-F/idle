/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/format.test.ts
 * O que faz: testa a formatação de números e de tempo que aparece na tela.
 */

import { describe, expect, it } from 'vitest';

import { formatDuration, formatNumber, formatPercent } from '../src/utils/format';

describe('formatação', () => {
  it('abrevia números grandes com K, M, B, T, Qa e Qi', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999.9)).toBe('999');
    expect(formatNumber(1234)).toBe('1,23K');
    expect(formatNumber(5_600_000)).toBe('5,60M');
    expect(formatNumber(7.5e9)).toBe('7,50B');
    expect(formatNumber(1e12)).toBe('1,00T');
    expect(formatNumber(2e15)).toBe('2,00Qa');
    expect(formatNumber(3e18)).toBe('3,00Qi');
    expect(formatNumber(4e21)).toBe('4,00e+21');
    expect(formatNumber(Number.NaN)).toBe('0');
  });

  it('escreve porcentagem e duração', () => {
    expect(formatPercent(0.256)).toBe('26%');
    expect(formatDuration(9)).toBe('9s');
    expect(formatDuration(75)).toBe('1min 15s');
    expect(formatDuration(3725)).toBe('1h 02min 05s');
  });
});
