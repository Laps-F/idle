# Histórico de mudanças

O que mudou em cada etapa e em quais arquivos. A entrada mais nova fica em cima.

## 14/11/2026: documentação e ausência no painel de debug

- Documentação nova: `docs/GUIA_DE_MANUTENCAO.md` (o que mudar e onde), `docs/COMO_TESTAR.md`
  (passo a passo de teste) e este histórico.
- Painel de debug ganhou a seção "Ausência": botões para simular 1 hora e 12 horas fora e o
  relatório de volta. Arquivo: `src/components/DebugView.tsx`.
- Store ganhou a ação de teste `debugSkipTime`. Arquivo: `src/store/useGameStore.ts`.
- Testes novos em `src/__tests__/DebugView.test.tsx`.

## 14/11/2026: painel de debug

- `src/components/DebugView.tsx`: métricas em tempo real, indicador de tick, controles de
  teste e salvamento (gravar, exportar, importar, apagar tudo em três cliques).
- `src/store/useGameStore.ts`: contador `tickCount` e ações de teste `debugHitEnemy` e
  `debugGrantGold`.
- `src/engine/simulation.ts`: `dealDirectDamage`, dano direto que segue o caminho normal de
  derrota e recompensas.
- `src/utils/format.ts`: números com K, M, B, T, Qa e Qi, duração e horário.
- `src/store/saveManager.ts`: `getSavedGameSize`, usado na mensagem de gravação.
- Tailwind instalado (`vite.config.ts`, `src/index.css`). `src/App.tsx` passou a mostrar o
  painel.
- Testes novos: `src/__tests__/DebugView.test.tsx` e `src/__tests__/format.test.ts`.

## 14/11/2026: revisão do motor

- Entrada antes da atualização: toda ação da pessoa simula o jogo até o instante do clique
  antes de ser aplicada (`applyInput`, em `src/store/useGameStore.ts`).
- Uma aba só: `src/store/tabGuard.ts` avisa quando o jogo é aberto em outra aba. A aba antiga
  para de simular e de gravar (`yieldToAnotherTab` na store, `disable` em
  `src/store/saveManager.ts`).
- `src/store/gameLoop.ts`: liga a proteção de abas e documenta por que usa `setInterval`.

## 14/11/2026: motor e estado global

- Base do projeto: Vite, React, TypeScript e Zustand.
- `src/types/game.ts`: tipagens.
- `src/data`: encantados, visagens, Oferendas, melhorias, sinergias, zona Mata Atlântica e
  constantes de balanceamento.
- `src/engine`: fórmulas, relógio do sertão, combate por eventos, pactos e progresso offline.
- `src/store`: `useGameStore` com `tick` por tempo real, relatório de ausência, gravação no
  `localStorage`, exportar, importar e apagar tudo.
- Testes dos dados, do motor e da store.
