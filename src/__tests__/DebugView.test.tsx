// @vitest-environment jsdom
/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/__tests__/DebugView.test.tsx
 * O que faz: testa o painel de debug em um navegador simulado: o que ele
 * mostra e o que cada botão faz na store.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import DebugView from '../components/DebugView';
import { SAVE_STORAGE_KEY } from '../store/saveManager';
import { useGameStore } from '../store/useGameStore';

let host: HTMLDivElement;
let root: Root;

// Clica no botão cujo texto começa com o trecho informado
async function click(labelStart: string): Promise<void> {
  const buttons = [...host.querySelectorAll('button')];
  const button = buttons.find((candidate) => candidate.textContent?.startsWith(labelStart));

  if (button === undefined) {
    throw new Error(`Botão "${labelStart}" não encontrado no painel.`);
  }

  await act(async () => button.click());
}

// Roda um tick da store, um décimo de segundo depois do último
async function tick(): Promise<void> {
  await act(async () => {
    useGameStore.getState().tick(useGameStore.getState().lastSaveTimestamp + 100);
  });
}

function getTextarea(): HTMLTextAreaElement {
  return host.querySelector('textarea') as HTMLTextAreaElement;
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  useGameStore.getState().hardReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<DebugView />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('painel de debug', () => {
  it('mostra todas as seções e pede a escolha do encantado inicial', () => {
    const titles = [...host.querySelectorAll('h2')].map((title) => title.textContent);
    expect(titles).toEqual([
      'Laço do jogo',
      'Ausência',
      'Combate',
      'Recursos',
      'Comitiva',
      'Melhorias',
      'Controles de teste',
      'Salvamento',
    ]);
    expect(host.textContent).toContain('Escolha quem começa');
  });

  it('mostra só as seções pedidas', async () => {
    await act(async () => root.render(<DebugView sectionIds={['loop', 'save']} />));
    const titles = [...host.querySelectorAll('h2')].map((title) => title.textContent);
    expect(titles).toEqual(['Laço do jogo', 'Salvamento']);
  });

  it('atualiza o contador de ticks e as métricas a cada tick', async () => {
    await click('Saci');
    const countBefore = useGameStore.getState().tickCount;
    await tick();
    await tick();
    expect(host.textContent).toContain(`Ticks desde que a página abriu${countBefore + 2}`);
    expect(host.textContent).toContain('Saci, nível 1');
    expect(host.textContent).toContain('Mata Atlântica');
  });

  it('tira vida do inimigo com o golpe manual e soma Patacas', async () => {
    await click('Saci');
    const maxHp = useGameStore.getState().combat.enemyMaxHp;
    await click('Golpe manual');
    expect(useGameStore.getState().combat.enemyHp).toBeCloseTo(maxHp * 0.75, 6);

    await click('Derrotar inimigo');
    expect(useGameStore.getState().stats.totalKills).toBe(1);

    const goldBefore = useGameStore.getState().gold;
    await click('+100 Patacas');
    expect(useGameStore.getState().gold).toBe(goldBefore + 100);
    expect(host.textContent).toContain(`Patacas${goldBefore + 100}`);
  });

  it('compra melhoria pelo botão e desliga o botão sem Patacas', async () => {
    await click('Saci');
    const button = [...host.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.startsWith('Reza forte'),
    );
    expect(button?.disabled).toBe(true);

    await click('+100 Patacas');
    await click('Reza forte');
    expect(useGameStore.getState().upgrades['reza-forte']).toBe(1);
    expect(host.textContent).toContain('Reza forte, nível 1: 12 Patacas');
  });

  it('grava no localStorage pelo botão', async () => {
    await click('Saci');
    await tick();
    await click('Gravar agora');
    const saved = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) ?? '{}');
    expect(saved.state.party).toEqual(['saci']);
    expect(host.textContent).toContain('caracteres no localStorage');
  });

  it('exporta para a caixa de texto e importa de volta', async () => {
    await click('Saci');
    await click('+10,00K Patacas');
    await click('Exportar');
    const code = getTextarea().value;
    expect(code.length).toBeGreaterThan(100);
    expect(host.textContent).toContain('Código exportado');

    await act(async () => useGameStore.getState().hardReset());
    expect(useGameStore.getState().gold).toBe(0);

    await click('Importar');
    expect(useGameStore.getState().gold).toBe(10_000);
    expect(useGameStore.getState().party).toEqual(['saci']);
    expect(host.textContent).toContain('Jogo importado.');
  });

  it('avisa quando o código importado é inválido ou está vazio', async () => {
    await click('Importar');
    expect(host.textContent).toContain('Cole um código');

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setValue?.call(getTextarea(), 'isto não é um salvamento');
      getTextarea().dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('Importar');
    expect(host.textContent).toContain('Não consegui ler esse código');
  });

  it('simula uma ausência e mostra o relatório de volta', async () => {
    await click('Saci');
    expect(host.textContent).toContain('Nenhum relatório de ausência aberto.');

    await click('Simular 1 hora fora');
    const report = useGameStore.getState().offlineReport;
    expect(report?.secondsSimulated).toBeCloseTo(1800, 0);
    expect(host.textContent).toContain('Tempo que rendeu30min 00s');
    expect(useGameStore.getState().gold).toBeGreaterThan(0);

    await click('Fechar relatório');
    expect(useGameStore.getState().offlineReport).toBeNull();
  });

  it('respeita o teto de 8 horas na ausência simulada', async () => {
    await click('Saci');
    await click('Simular 12 horas fora');
    expect(host.textContent).toContain('Tempo que rendeu4h 00min 00s');
  });

  it('só apaga tudo depois de três cliques', async () => {
    await click('Saci');
    await click('Apagar tudo');
    await click('Tem certeza?');
    expect(useGameStore.getState().party).toEqual(['saci']);

    await click('Última chance');
    expect(useGameStore.getState().party).toEqual([]);
    expect(host.textContent).toContain('Jogo apagado.');
    expect(host.textContent).toContain('Escolha quem começa');
  });
});
