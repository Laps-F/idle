/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: tests/architecture.test.ts
 * O que faz: vigia as regras de arquitetura do projeto. Lê os arquivos de src
 * e falha se alguma camada importar o que não pode, se o domínio ler o
 * relógio, o sorteio ou o navegador, ou se aparecer "any" no código.
 *
 * As regras estão descritas em docs/GUIA_DE_MANUTENCAO.md, seção 1.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(process.cwd(), 'src');

// Pastas permitidas em src. Arquivos soltos permitidos ficam em ROOT_FILES.
const LAYERS = ['domain', 'store', 'data', 'components', 'utils'] as const;
const ROOT_FILES = ['App.tsx', 'main.tsx', 'index.css'];

type Layer = (typeof LAYERS)[number];

// De quais camadas cada camada pode importar (além dela mesma)
const ALLOWED_IMPORTS: Record<Layer, readonly Layer[]> = {
  utils: [],
  data: ['domain'], // só tipos, conferido à parte
  domain: ['data', 'utils'],
  store: ['domain', 'data', 'utils'],
  components: ['store', 'utils'],
};

// Pacotes de fora que cada camada pode usar
const ALLOWED_PACKAGES: Record<Layer, readonly string[]> = {
  utils: [],
  data: [],
  domain: [],
  store: ['zustand', 'zustand/middleware'],
  components: ['react'],
};

// O que tiraria a pureza do domínio: relógio, sorteio, navegador e saída no console
const IMPURE_TOKENS = [
  'Date.now',
  'new Date',
  'Math.random',
  'window.',
  'document.',
  'localStorage',
  'console.',
  'setTimeout',
  'setInterval',
];

interface SourceFile {
  path: string; // relativo a src, com barras normais
  layer: Layer | null; // null para arquivos soltos na raiz de src
  code: string; // conteúdo sem comentários
  imports: ImportLine[];
}

interface ImportLine {
  specifier: string;
  isTypeOnly: boolean;
}

// Lista todos os arquivos de uma pasta, entrando nas subpastas
function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

// Tira comentários de bloco e de linha, para a regra olhar só o código
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// Extrai as linhas de import e de re-export de um arquivo
function readImports(code: string): ImportLine[] {
  const pattern = /^\s*(import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm;
  return [...code.matchAll(pattern)].map((match) => ({
    specifier: match[3] ?? '',
    isTypeOnly: match[2] !== undefined,
  }));
}

function readSourceFile(fullPath: string): SourceFile {
  const path = relative(SOURCE_ROOT, fullPath).split(sep).join('/');
  const firstFolder = path.includes('/') ? path.split('/')[0] : null;
  const layer = LAYERS.find((candidate) => candidate === firstFolder) ?? null;
  const code = stripComments(readFileSync(fullPath, 'utf8'));
  return { path, layer, code, imports: readImports(code) };
}

// Camada de destino de um import relativo, como "../domain/types". Null se não for de src.
function getImportedLayer(file: SourceFile, specifier: string): Layer | null {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const segments = specifier.split('/');
  const goesUp = segments[0] === '..';
  const target = goesUp ? segments[1] : file.layer;
  return LAYERS.find((candidate) => candidate === target) ?? null;
}

const allPaths = listFiles(SOURCE_ROOT);
const codeFiles = allPaths.filter((path) => /\.tsx?$/.test(path)).map(readSourceFile);
const layerFiles = codeFiles.filter((file) => file.layer !== null);

describe('arquitetura', () => {
  it('src só tem as cinco pastas combinadas e os arquivos de entrada', () => {
    const entries = readdirSync(SOURCE_ROOT).sort();
    expect(entries).toEqual([...LAYERS, ...ROOT_FILES].sort());
  });

  it('cada camada só importa das camadas permitidas', () => {
    const violations = layerFiles.flatMap((file) =>
      file.imports
        .map((line) => getImportedLayer(file, line.specifier))
        .filter((target): target is Layer => target !== null && target !== file.layer)
        .filter((target) => !ALLOWED_IMPORTS[file.layer as Layer].includes(target))
        .map((target) => `${file.path} importa de ${target}`),
    );
    expect(violations).toEqual([]);
  });

  it('cada camada só usa os pacotes de fora permitidos', () => {
    const violations = layerFiles.flatMap((file) =>
      file.imports
        .filter((line) => !line.specifier.startsWith('.'))
        .filter((line) => !ALLOWED_PACKAGES[file.layer as Layer].includes(line.specifier))
        .map((line) => `${file.path} importa o pacote ${line.specifier}`),
    );
    expect(violations).toEqual([]);
  });

  it('src/data só importa tipos do domínio e não tem função', () => {
    const dataFiles = layerFiles.filter((file) => file.layer === 'data');
    const valueImports = dataFiles.flatMap((file) =>
      file.imports
        .filter((line) => getImportedLayer(file, line.specifier) === 'domain' && !line.isTypeOnly)
        .map((line) => `${file.path} importa valor de ${line.specifier}`),
    );
    const withFunctions = dataFiles
      .filter((file) => /\bfunction\b|=>/.test(file.code))
      .map((file) => file.path);

    expect(valueImports).toEqual([]);
    expect(withFunctions).toEqual([]);
  });

  it('src/domain não lê relógio, sorteio, navegador nem console', () => {
    const violations = layerFiles
      .filter((file) => file.layer === 'domain')
      .flatMap((file) =>
        IMPURE_TOKENS.filter((token) => file.code.includes(token)).map(
          (token) => `${file.path} usa ${token}`,
        ),
      );
    expect(violations).toEqual([]);
  });

  it('nenhum arquivo usa "any"', () => {
    const anyPattern = /:\s*any\b|<any>|\bas any\b|\bany\[\]|Array<any>/;
    const violations = codeFiles.filter((file) => anyPattern.test(file.code)).map((f) => f.path);
    expect(violations).toEqual([]);
  });
});
