// @vitest-environment jsdom
/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/WorldScreen.test.tsx
 * O que faz: testa a tela do mundo aberto num navegador simulado: a escolha
 * inicial, o painel do lado, a legenda das imagens que faltam e o teclado.
 * O navegador simulado não tem canvas, então o desenho do mapa não é testado
 * aqui (a regra do mapa está em tests/world.test.ts).
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import WorldScreen from '../src/components/world/WorldScreen';
import { useGameStore } from '../src/store/useGameStore';

let host: HTMLDivElement;
let root: Root;

async function mount(): Promise<void> {
  await act(async () => root.render(<WorldScreen />));
}

// Aperta ou solta uma tecla, pela posição dela no teclado
async function press(type: 'keydown' | 'keyup', code: string): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // O jsdom avisa que não tem canvas. O componente já sabe lidar com isso.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  localStorage.clear();
  useGameStore.getState().hardReset();
  useGameStore.getState().setEngine('mundo');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('tela do mundo aberto', () => {
  it('pede o encantado inicial e depois mostra quem anda e onde', async () => {
    await mount();
    expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('Quem começa com você?');

    const starter = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.startsWith('Começar com Saci'),
    );
    await act(async () => starter?.click());

    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(host.textContent).toContain('Saci');
    expect(host.textContent).toContain('Beira da Mata (nível 1)');
    expect(host.querySelector('canvas')).not.toBeNull();
  });

  it('marca na legenda o arquivo de cada imagem que ainda falta', async () => {
    await mount();
    const legend = host.querySelector('[aria-label="Imagens que faltam"]')?.textContent ?? '';

    for (const file of ['tree.png', 'water.png', 'grass.png', 'path.png', 'portal.png']) {
      expect(legend).toContain(file);
    }
  });

  it('transforma as teclas na direção da personagem', async () => {
    await mount();

    await press('keydown', 'KeyD');
    await press('keydown', 'ArrowUp');
    expect(useGameStore.getState().worldInput).toEqual({ moveX: 1, moveY: -1 });

    await press('keydown', 'KeyA');
    expect(useGameStore.getState().worldInput).toEqual({ moveX: 0, moveY: -1 });

    await press('keyup', 'ArrowUp');
    await press('keyup', 'KeyA');
    await press('keyup', 'KeyD');
    expect(useGameStore.getState().worldInput).toEqual({ moveX: 0, moveY: 0 });
  });

  it('solta as teclas quando a janela perde o foco', async () => {
    await mount();
    await press('keydown', 'KeyS');
    await act(async () => window.dispatchEvent(new Event('blur')));
    expect(useGameStore.getState().worldInput).toEqual({ moveX: 0, moveY: 0 });
  });
});
