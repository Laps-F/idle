// @vitest-environment jsdom
/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/GameScreen.test.tsx
 * O que faz: testa a interface de produção em um navegador simulado: o que
 * cada painel mostra, o que cada botão faz na store e, principalmente, que as
 * animações de alta frequência não redesenham os componentes.
 */

import { Profiler, act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import GameScreen from '../src/components/GameScreen';
import { AttackBars } from '../src/components/arena/AttackBars';
import { useGameStore } from '../src/store/useGameStore';

const ONE_HOUR_MS = 3600 * 1000;

let host: HTMLDivElement;
let root: Root;

// Botão cujo texto começa com o trecho informado. Com "inside", procura só dentro do seletor.
function findButton(labelStart: string, inside = 'body'): HTMLButtonElement {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(`${inside} button`)];
  const button = buttons.find((candidate) => candidate.textContent?.trim().startsWith(labelStart));

  if (button === undefined) {
    throw new Error(`Botão "${labelStart}" não encontrado.`);
  }

  return button;
}

async function click(labelStart: string, inside = 'body'): Promise<void> {
  const button = findButton(labelStart, inside);
  await act(async () => button.click());
}

// Roda ticks de 0,1 s na store, como o laço do jogo faz
async function runTicks(count: number): Promise<void> {
  for (let tick = 0; tick < count; tick += 1) {
    await act(async () => {
      useGameStore.getState().tick(useGameStore.getState().lastSaveTimestamp + 100);
    });
  }
}

// Escreve em uma caixa de texto do jeito que o React percebe
async function typeInto(textarea: HTMLTextAreaElement, text: string): Promise<void> {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setValue?.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function getDialogTitle(): string | null {
  return document.querySelector('[role=dialog] h2')?.textContent ?? null;
}

async function mount(): Promise<void> {
  await act(async () => root.render(<GameScreen />));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  useGameStore.getState().hardReset();
  useGameStore.getState().dismissOfflineReport();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('começo do jogo', () => {
  it('pede a escolha do encantado inicial e fecha a janela depois dela', async () => {
    await mount();
    expect(getDialogTitle()).toBe('Quem começa com você?');
    expect(document.querySelectorAll('[role=dialog] li')).toHaveLength(3);

    await click('Começar com Curupira');
    expect(getDialogTitle()).toBeNull();
    expect(useGameStore.getState().party).toEqual(['curupira']);
    expect(host.textContent).toContain('Mata Atlântica');
    expect(host.textContent).toContain('Curupira');
  });
});

describe('cabeçalho', () => {
  it('mostra os recursos formatados, a zona e o estágio', async () => {
    useGameStore.getState().chooseStarter('saci');
    useGameStore.getState().debugGrantGold(12_345);
    useGameStore.setState({ inventory: { 'mel-silvestre': 7 } });
    await mount();

    const header = host.querySelector('header')?.textContent ?? '';
    expect(header).toContain('12,35K');
    expect(header).toContain('Mel silvestre7');
    expect(header).toContain('Mata Atlântica, estágio 1');
  });

  it('exporta, recusa código inválido e importa de volta', async () => {
    useGameStore.getState().chooseStarter('iara');
    useGameStore.getState().debugGrantGold(500);
    await mount();

    await click('Exportar');
    expect(getDialogTitle()).toBe('Exportar o jogo');
    const code = document.querySelector<HTMLTextAreaElement>('[role=dialog] textarea')?.value ?? '';
    expect(code.length).toBeGreaterThan(100);
    await click('Fechar');

    await act(async () => useGameStore.getState().debugGrantGold(9_000));
    await click('Importar');
    const textarea = document.querySelector<HTMLTextAreaElement>('[role=dialog] textarea');
    expect(findButton('Importar', '[role=dialog]').disabled).toBe(true);

    await typeInto(textarea as HTMLTextAreaElement, 'abc');
    await click('Importar', '[role=dialog]');
    expect(document.querySelector('[role=alert]')?.textContent).toContain('Não consegui ler');
    expect(useGameStore.getState().gold).toBe(9_500);

    await typeInto(textarea as HTMLTextAreaElement, code);
    await click('Importar', '[role=dialog]');
    expect(getDialogTitle()).toBeNull();
    expect(useGameStore.getState().gold).toBe(500);
  });

  it('só apaga tudo depois de duas confirmações', async () => {
    useGameStore.getState().chooseStarter('saci');
    await mount();

    await click('Apagar tudo');
    expect(getDialogTitle()).toBe('Apagar todo o progresso?');
    await click('Cancelar');
    expect(useGameStore.getState().party).toEqual(['saci']);

    await click('Apagar tudo');
    await click('Quero apagar');
    expect(getDialogTitle()).toBe('Última confirmação');
    expect(useGameStore.getState().party).toEqual(['saci']);

    await click('Apagar tudo agora');
    expect(useGameStore.getState().party).toEqual([]);
    expect(getDialogTitle()).toBe('Quem começa com você?');
  });
});

describe('arena', () => {
  it('mostra o inimigo, a vida e o caminho até o chefe', async () => {
    useGameStore.getState().chooseStarter('saci');
    await mount();
    const maxHp = useGameStore.getState().combat.enemyMaxHp;

    expect(host.querySelector('[aria-label="Arena"] h2')?.textContent).not.toBe('');
    expect(host.textContent).toContain(`Vida: ${maxHp} de ${maxHp}`);
    expect(host.textContent).toContain('0 de 10 visagens até o chefe');

    await act(async () => useGameStore.getState().debugHitEnemy(1));
    expect(host.textContent).toContain('1 de 10 visagens até o chefe');
  });

  it('mostra o chefe com o tempo que resta', async () => {
    useGameStore.getState().chooseStarter('saci');
    useGameStore.getState().setAutoProgress(false);
    for (let kill = 0; kill < 10; kill += 1) {
      useGameStore.getState().debugHitEnemy(1);
    }
    useGameStore.getState().challengeBoss();
    await mount();

    expect(host.textContent).toContain('Corpo-Seco');
    expect(host.textContent).toContain('Chefe do estágio');
    expect(host.textContent).toContain('Faltam 30 s para o chefe escapar');
  });

  it('registra o que aconteceu e solta números a cada golpe', async () => {
    useGameStore.getState().chooseStarter('saci');
    await mount();
    expect(host.textContent).toContain('As novidades do combate aparecem aqui.');

    await runTicks(50);
    expect(host.textContent).toMatch(/caiu: \+\d+ Patacas|visagens caíram/);
    expect(host.querySelectorAll('.float-text').length).toBeGreaterThan(0);
  });

  it('anda a barra de ataque por ref, sem redesenhar o componente', async () => {
    useGameStore.getState().chooseStarter('saci');
    let commits = 0;
    const countCommit = (): void => {
      commits += 1;
    };

    await act(async () =>
      root.render(
        <Profiler id="barras" onRender={countCommit}>
          <AttackBars />
        </Profiler>,
      ),
    );
    const fill = host.querySelector<HTMLDivElement>('.meter-fill');
    const commitsAfterMount = commits;

    await runTicks(5);
    const firstTransform = fill?.style.transform;
    await runTicks(3);

    expect(firstTransform).toMatch(/^scaleX\(0\.\d+\)$/);
    expect(fill?.style.transform).not.toBe(firstTransform);
    expect(commits).toBe(commitsAfterMount);
  });
});

describe('melhorias e estágios', () => {
  it('liga o botão de compra conforme as Patacas e avisa na aba', async () => {
    useGameStore.getState().chooseStarter('saci');
    await mount();
    expect(findButton('Comprar por 10 Patacas').disabled).toBe(true);
    expect(host.querySelector('#tab-melhorias span')).toBeNull();

    await act(async () => useGameStore.getState().debugGrantGold(30));
    expect(findButton('Comprar por 10 Patacas').disabled).toBe(false);
    expect(host.querySelector('#tab-melhorias span')?.textContent).toBe('2');

    await click('Comprar por 10 Patacas');
    expect(useGameStore.getState().upgrades['reza-forte']).toBe(1);
    expect(host.textContent).toContain('Comprar por 12 Patacas');
  });

  it('navega entre estágios liberados e controla o chefe', async () => {
    useGameStore.getState().chooseStarter('saci');
    useGameStore.setState({ maxStage: 3 });
    await mount();
    await click('Estágios');

    expect(findButton('Anterior').disabled).toBe(true);
    await click('Próximo');
    expect(useGameStore.getState().stage).toBe(2);
    await click('Mais alto');
    expect(useGameStore.getState().stage).toBe(3);
    expect(findButton('Próximo').disabled).toBe(true);
    await click('Anterior');
    expect(useGameStore.getState().stage).toBe(2);

    expect(findButton('Desafiar o chefe').disabled).toBe(true);
    expect(host.textContent).toContain('Faltam 10 visagens para o chefe aparecer.');

    const checkbox = host.querySelector<HTMLInputElement>('input[type=checkbox]');
    await act(async () => checkbox?.click());
    expect(useGameStore.getState().autoProgress).toBe(false);

    for (let kill = 0; kill < 10; kill += 1) {
      await act(async () => useGameStore.getState().debugHitEnemy(1));
    }
    await click('Desafiar o chefe');
    expect(useGameStore.getState().combat.isBoss).toBe(true);
    expect(host.textContent).toContain('O chefe já está em campo.');
  });
});

describe('comitiva e Almanaque', () => {
  it('fecha um pacto quando tudo está juntado e põe o encantado na comitiva', async () => {
    useGameStore.getState().chooseStarter('saci');
    await mount();
    await click('Almanaque');
    expect(findButton('Fechar pacto').disabled).toBe(true);
    expect(host.textContent).toContain('Rastros: 0 de 3');

    await act(async () =>
      useGameStore.setState({ trails: { caipora: 3 }, inventory: { 'mel-silvestre': 5 } }),
    );
    expect(host.querySelector('#tab-almanaque span')?.textContent).toBe('1');
    await click('Fechar pacto');

    expect(useGameStore.getState().party).toEqual(['saci', 'caipora']);
    expect(host.textContent).toContain('Pacto fechado. Já está no seu elenco.');
    expect(host.querySelectorAll('[aria-label="Golpes da comitiva"] li')).toHaveLength(2);
  });

  it('tira e chama de volta um encantado, sem deixar a comitiva vazia', async () => {
    useGameStore.getState().chooseStarter('saci');
    useGameStore.setState({ trails: { caipora: 3 }, inventory: { 'mel-silvestre': 5 } });
    useGameStore.getState().sealPact('caipora');
    await mount();

    await click('Tirar da comitiva');
    expect(useGameStore.getState().party).toEqual(['caipora']);
    expect(findButton('Tirar da comitiva').disabled).toBe(true);

    await click('Chamar para a comitiva');
    expect(useGameStore.getState().party).toEqual(['caipora', 'saci']);
    expect(host.textContent).toContain('Guarda da Mata');
  });
});

describe('janelas automáticas', () => {
  it('dá as boas-vindas de volta ao abrir depois de uma ausência', async () => {
    useGameStore.getState().chooseStarter('saci');
    useGameStore.setState({
      lastSaveTimestamp: useGameStore.getState().lastSaveTimestamp - ONE_HOUR_MS,
    });
    await mount();
    expect(getDialogTitle()).toBeNull();

    // O primeiro tick depois de abrir a página calcula a ausência
    await act(async () => useGameStore.getState().tick(Date.now()));
    expect(getDialogTitle()).toBe('Que bom que você voltou');
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('1h 00min 00s fora');
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('30min 00s');

    await click('Continuar');
    expect(getDialogTitle()).toBeNull();
    expect(useGameStore.getState().offlineReport).toBeNull();
  });

  it('não abre a janela de volta quando a ausência não rendeu nada', async () => {
    useGameStore.setState({
      lastSaveTimestamp: useGameStore.getState().lastSaveTimestamp - ONE_HOUR_MS,
    });
    await mount();
    await act(async () => useGameStore.getState().tick(Date.now()));
    expect(getDialogTitle()).toBe('Quem começa com você?');
    expect(useGameStore.getState().offlineReport).toBeNull();
  });
});
