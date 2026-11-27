// @vitest-environment jsdom
/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/TuningPanel.test.tsx
 * O que faz: testa o painel "Ajustes" num navegador simulado: abrir pelo
 * botão do cabeçalho, buscar, mudar um número, ver a contagem no botão, o
 * atalho de nível, o "Desfazer tudo" e o botão de fechar.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TuningButton } from '../src/components/debug/TuningPanel';
import { BALANCE } from '../src/data';
import { resetTuning } from '../src/store/tuning';
import { useGameStore } from '../src/store/useGameStore';

let host: HTMLDivElement;
let root: Root;

// Primeiro botão cujo texto começa com o rótulo pedido
function findButton(labelStart: string): HTMLButtonElement {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];
  const button = buttons.find((candidate) => candidate.textContent?.trim().startsWith(labelStart));

  if (button === undefined) {
    throw new Error(`Botão "${labelStart}" não encontrado.`);
  }

  return button;
}

async function click(labelStart: string): Promise<void> {
  const button = findButton(labelStart);
  await act(async () => button.click());
}

// Escreve num campo e sai dele, como a pessoa faz
async function typeAndLeave(label: string, value: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);

  if (input === null) {
    throw new Error(`Campo "${label}" não encontrado.`);
  }

  await act(async () => {
    input.focus();
    input.value = value;
    input.blur();
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  resetTuning(null);
  useGameStore.getState().hardReset();
  useGameStore.getState().chooseStarter('saci');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<TuningButton />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  resetTuning(null);
  localStorage.clear();
});

describe('painel Ajustes', () => {
  it('muda um número, mostra a contagem no botão e desfaz tudo', async () => {
    const original = BALANCE.enemyBaseHp;
    await click('Ajustes');
    expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Ajustes de teste');

    await typeAndLeave('Vida base da visagem no nível 1', '40');

    expect(BALANCE.enemyBaseHp).toBe(40);
    expect(findButton('Ajustes (1)')).toBeDefined();
    expect(document.body.textContent).toContain(`código: ${original}`);
    expect(document.body.textContent).toContain('src/data/balance.ts, enemyBaseHp');

    await click('Desfazer tudo');
    expect(BALANCE.enemyBaseHp).toBe(original);
    expect(findButton('Ajustes').textContent?.trim()).toBe('Ajustes');
  });

  it('fecha pelo botão "Fechar"', async () => {
    await click('Ajustes');
    expect(document.querySelector('[role=dialog]')).not.toBeNull();

    await click('Fechar');
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });

  it('a busca deixa só os ajustes com o termo', async () => {
    await click('Ajustes');
    const search = document.querySelector<HTMLInputElement>('input[type=search]');

    await act(async () => {
      if (search !== null) {
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setValue?.call(search, 'recarga');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const labels = [...document.querySelectorAll('[role=dialog] li > span:first-child')].map(
      (span) => span.textContent,
    );
    expect(labels).toEqual([
      'Recarga da troca de quem está em campo (s)',
      'Recarga do golpe especial padrão (s)',
    ]);
  });

  it('o atalho muda o nível do primeiro da comitiva', async () => {
    await click('Ajustes');
    await typeAndLeave('Nível do primeiro da comitiva', '15');
    expect(useGameStore.getState().roster.saci?.level).toBe(15);
  });
});
