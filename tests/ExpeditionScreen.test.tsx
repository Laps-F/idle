// @vitest-environment jsdom
/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/ExpeditionScreen.test.tsx
 * O que faz: testa as telas da expedição num navegador simulado: a aba
 * "Expedições" da clareira, a troca de tela ao partir, o painel ao lado do
 * mapa, o teclado (direção e golpe especial), o botão de voltar e a janela
 * da volta. O navegador simulado não tem canvas, então o desenho do mapa não
 * é testado aqui (as regras do mapa estão em tests/expedition.test.ts).
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../src/App';
import { useGameStore } from '../src/store/useGameStore';

let host: HTMLDivElement;
let root: Root;

// Monta a tela do jogo (clareira ou expedição, conforme o estado)
async function mount(): Promise<void> {
  await act(async () => root.render(<App />));
}

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
  useGameStore.getState().chooseStarter('saci');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('aba Expedições da clareira', () => {
  it('mostra quem sai e os mapas, e troca para a tela da expedição ao partir', async () => {
    await mount();
    expect(host.textContent).toContain('Quem sai: Saci, com 100 de vida.');
    expect(host.textContent).toContain('Brejo Escuro');

    await click('Partir para Beira da Mata');

    expect(useGameStore.getState().expedition?.mapId).toBe('beira-da-mata');
    expect(host.querySelector('canvas')).not.toBeNull();
    expect(host.textContent).toContain('Quem saiu: Saci');
    expect(host.textContent).toContain('Visagens na bolsa: 0');
  });
});

describe('tela da expedição', () => {
  it('marca na legenda o arquivo de cada imagem que ainda falta', async () => {
    useGameStore.getState().startExpedition('beira-da-mata');
    await mount();
    const legend = host.querySelector('[aria-label="Imagens que faltam"]')?.textContent ?? '';

    for (const file of ['tree.png', 'water.png', 'grass.png', 'path.png', 'portal.png']) {
      expect(legend).toContain(file);
    }
  });

  it('transforma as teclas em direção e o espaço em golpe especial', async () => {
    useGameStore.getState().startExpedition('beira-da-mata');
    await mount();

    await press('keydown', 'KeyD');
    await press('keydown', 'ArrowUp');
    expect(useGameStore.getState().moveInput).toEqual({ moveX: 1, moveY: -1 });

    await press('keydown', 'Space');
    expect(useGameStore.getState().isSpecialPending).toBe(true);

    await act(async () => window.dispatchEvent(new Event('blur')));
    expect(useGameStore.getState().moveInput).toEqual({ moveX: 0, moveY: 0 });
  });

  it('volta para a clareira pelo botão e mostra a janela da volta', async () => {
    useGameStore.getState().startExpedition('beira-da-mata');
    await mount();

    await click('Voltar para a clareira agora');

    expect(useGameStore.getState().expedition).toBeNull();
    expect(document.querySelector('[role=dialog] h2')?.textContent).toBe('De volta à clareira');
    expect(host.textContent).toContain('Visagens na bolsa');

    await click('Voltar para a clareira');
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
