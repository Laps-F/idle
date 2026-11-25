/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: vite.config.ts
 * O que faz: configuração do Vite (servidor local e build).
 *
 * O jogo é publicado no GitHub Pages em https://laps-f.github.io/idle/, ou
 * seja, dentro da pasta /idle/ do site. Por isso o build usa essa base: sem
 * ela, o navegador procuraria os arquivos em /assets/ e a página abriria em
 * branco. O npm run preview usa a mesma base, então abre em
 * http://localhost:4173/idle/. Só o servidor de desenvolvimento (npm run dev)
 * continua em /.
 *
 * Mudou o nome do repositório ou passou a usar um domínio próprio? Troque
 * PAGES_BASE (domínio próprio usa '/').
 */

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const PAGES_BASE = '/idle/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview === true ? PAGES_BASE : '/',
  plugins: [react(), tailwindcss()],
}));
