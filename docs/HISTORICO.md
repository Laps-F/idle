# Histórico de mudanças

O que mudou em cada etapa e em quais arquivos. A entrada mais nova fica em cima.

## 15/11/2026: amuletos, o primeiro sistema de retenção

Chefes e visagens passam a deixar amuletos, que os encantados vestem. Amuleto que sobra vira
Cavacos, e Cavacos pagam o entalhe. O salvamento subiu para a versão 2.

Domínio:

- `src/domain/amulets.ts` (novo): sorteio da queda (`rollAmuletDrop`), geração dos atributos
  (`generateAmulet`), entrada na mochila (`receiveAmulet`), vestir e tirar (`equipAmulet`,
  `unequipAmulet`), desmanche (`salvageAmulet`, `salvageBagUpTo`, `setAutoSalvage`) e entalhe
  (`carveAmulet`). Tudo função pura, com o sorteio recebido por parâmetro.
- `src/domain/types.ts`: `Amulet`, `AmuletBonus`, `AmuletBaseDef`, `AmuletRarityDef`. O
  `GameState` ganhou `amulets`, `equipped`, `shavings`, `autoSalvage` e `nextAmuletNumber`. O
  resumo da simulação e os eventos de combate ganharam os campos de amuleto.
- `src/domain/simulation.ts`: `rollAmulet`, chamado a cada inimigo derrotado. É por aqui que o
  sistema entra no `tick` e no progresso offline.
- `src/domain/modifiers.ts`: os amuletos de quem está na comitiva entram como um terceiro
  multiplicador, ao lado de melhorias e sinergias.
- `src/domain/catalog.ts`, `state.ts`, `offline.ts`: consultas, estado inicial e soma dos
  relatórios.

Dados:

- `src/data/amulets.ts` (novo): seis tipos (`AMULET_BASES`) e quatro raridades com peso de
  sorteio (`AMULET_RARITIES`).
- `src/data/balance.ts`: chances de queda, tamanho da mochila, entalhe, desmanche e
  `saveVersion: 2`.

Store:

- `src/store/useGameStore.ts`: bloco "Ações de amuletos" e a ação de teste `debugGrantAmulet`.
- `src/store/saveManager.ts`: `MIGRATIONS[1]` leva um salvamento da versão 1 para a 2, e a
  conferência passou a tratar amuletos (tipo ou raridade desconhecidos, bônus inválidos,
  entalhe acima do máximo, amuleto vestido por duas pessoas).
- `src/store/selectors.ts`: `selectAmuletPanel`, Cavacos no cabeçalho, aviso na aba e amuletos
  no relatório de volta.
- `src/store/eventViews.ts`: linhas "amuleto encontrado" e "amuleto desmanchado".

Tela:

- `src/components/progress/AmuletsPanel.tsx` (novo): a aba "Amuletos".
- `src/components/GameScreen.tsx`: a aba nova, com aviso quando há amuleto para vestir.
- `src/components/art/figures.tsx`: xilogravuras dos seis amuletos.
- `src/components/theme.ts`: carimbos de raridade e textos dos bônus.
- `src/components/ui/Button.tsx`: tamanho `small`.
- `ResourceBar.tsx`, `EventLog.tsx`, `OfflineModal.tsx`, `DebugView.tsx`: Cavacos, linhas de
  registro, ganhos da ausência e o botão "Ganhar um amuleto".
- `src/index.css`: a cor `ouro`, só para o carimbo de lendário.

Ferramentas:

- `src/utils/random.ts`: `pickWeighted`, o sorteio por peso.
- `src/utils/format.ts`: `formatSignedPercent` e `formatCount`.

Testes:

- `tests/amulets.test.ts` (novo): 26 testes das regras, com sorteio de semente fixa e estado
  congelado.
- `tests/store.test.ts`: abertura e importação de salvamento da versão 1, amuletos
  adulterados, ações e queda pelo `tick`.
- `tests/GameScreen.test.tsx`: a aba, vestir, guardar, desmanchar, entalhar e desmanche
  automático.

Medições (um Saci sozinho, comprando melhorias sem parar, três sementes):

- Sem usar amuletos: estágio 19 ou 20 em 1 hora e 28 em 5 horas.
- Vestindo o melhor amuleto e entalhando: estágio 25 a 27 em 1 hora e 35 a 41 em 5 horas.
- Caem de 20 a 27 amuletos na primeira hora.

## 15/11/2026: interface de produção do MVP

A tela do jogo, no visual de folheto de cordel. O painel de debug continua em `/?debug`.

Tela:

- `src/App.tsx`: escolhe entre a tela do jogo e o painel de debug.
- `src/components/GameScreen.tsx` (novo): disposição em tela única, abas laterais e janelas
  automáticas. Traz a árvore de componentes no cabeçalho do arquivo.
- `src/components/header/` (novo): `AppHeader`, `ResourceBar`, `StageBadge` e `SaveMenu`.
- `src/components/arena/` (novo): `ArenaPanel`, `EnemyCover`, `AttackBars`,
  `FloatingTextLayer` e `EventLog`.
- `src/components/party/` (novo): `PartyPanel` e `AlmanacPanel`.
- `src/components/progress/` (novo): `UpgradesPanel` e `StagesPanel`.
- `src/components/modals/` (novo): `Modal`, `StarterModal`, `OfflineModal`, `SaveModals` e
  `OtherTabNotice`.
- `src/components/ui/` (novo): `Figure`, `Meter` (com `LiveMeter`), `Button` e `Tabs`.
- `src/components/art/figures.tsx` (novo): nove xilogravuras em SVG (cinco encantados, três
  visagens e o Corpo-Seco).
- `src/components/hooks/` (novo): `useStoreMeter` (barra movida por ref) e `useCombatFeed`
  (eventos de combate por fora do React).
- `src/components/theme.ts` (novo): papel de cada bioma e textos de apresentação.
- `src/index.css`: tema de cordel no Tailwind e animações em CSS. `src/main.tsx`: fontes.

Store e domínio:

- `src/store/selectors.ts`: visões granulares para a tela (cabeçalho, estágio, relógio,
  inimigo, vida, comitiva, sinergias, pactos, avisos das abas, escolha inicial) e as leituras
  de alta frequência `readAttackProgress` e `readBossTimeFraction`.
- `src/store/eventViews.ts` (novo): traduz os eventos de combate em golpes e linhas de registro.
- `src/domain/offline.ts`: `hasOfflineGains`. Ausência que não rendeu nada deixou de gerar
  relatório, para a janela de volta não abrir vazia.
- `src/utils/format.ts`: `formatDecimal`.

Dependências novas: `lucide-react` (ícones), `@fontsource/bowlby-one` e
`@fontsource-variable/bitter` (fontes, servidas junto com o jogo).

Testes:

- `tests/GameScreen.test.tsx` (novo): cada painel e janela, e a prova de que a barra de ataque
  anda sem redesenhar o componente.
- `tests/architecture.test.ts`: `lucide-react` liberado para `components`. Corrigida uma falha
  do próprio teste: ele não enxergava importações feitas de dentro de subpastas.

## 14/11/2026: adequação às diretrizes de arquitetura e Clean Code

Revisão de todo o código contra as diretrizes de arquitetura. O jogo se comporta igual.

Pastas:

- `src/engine` virou `src/domain`. `src/types/game.ts` virou `src/domain/types.ts`.
- Os testes saíram de `src/__tests__` para `tests/`, na raiz. `src` ficou só com as cinco
  pastas (`domain`, `store`, `data`, `components`, `utils`) e os arquivos de entrada.

Domínio puro:

- As funções do domínio deixaram de alterar o estado recebido. `advanceSimulation`,
  `dealDirectDamage` e `applyOfflineProgress` devolvem o estado novo. `sealPact` devolve o
  estado novo ou `null`.
- O sorteio deixou de ter `Math.random` como padrão: agora é sempre passado por parâmetro.
- Os eventos de combate vêm no resultado da simulação, em vez de sair por uma função de aviso.
- `src/domain/actions.ts` (novo): as regras das ações da pessoa, que estavam dentro da store.
- `src/domain/catalog.ts` (novo): as consultas por id e `getZoneForStage`, que estavam em
  `src/data/index.ts`. `src/data` ficou sem nenhuma função.
- `src/domain/state.ts`: `createCommonEnemyCombat` e `createBossCombat` no lugar das funções
  que alteravam o combate.

Store:

- `src/store/types.ts` (novo): tipagens da store, do estado de sessão e dos retornos.
- `src/store/useGameStore.ts`: ficou só coordenando. Cada ação chama uma regra do domínio.
- `src/store/selectors.ts` (novo): visões prontas para a tela, que devolvem a mesma referência
  enquanto o conteúdo não muda.
- `src/store/saveManager.ts`: payloads de salvamento tipados (`PersistedSave`, `ExportedSave`).
  O que vem de fora entra como `unknown` e só vira `GameState` depois da conferência, sem
  conversão forçada de tipo. A leitura do `localStorage` já devolve o estado migrado e conferido.
- `saveNow` passou a devolver um comprovante (`SaveReceipt`).

Componentes:

- `src/components/DebugView.tsx`: deixou de importar `domain` e `data` e de fazer contas. Recebe
  tudo pelos seletores. O botão "Desafiar chefe" fica apagado quando não há chefe para desafiar.

Utilitários e tipagem:

- `src/utils/id.ts` (novo): gerador de identificador único, usado por `tabGuard.ts`.
- `tsconfig.app.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` e
  `noImplicitReturns` ligados. `.oxlintrc.json`: regra `typescript/no-explicit-any`.
- JSDoc nos utilitários complexos, nos algoritmos de dano e de ausência e nas ações críticas
  da store.

Testes:

- `tests/architecture.test.ts` (novo): vigia as regras de pastas, de importação, de pureza do
  domínio e a proibição de `any`.
- `tests/domain.test.ts`: reescrito para as funções puras. O estado de entrada é congelado, então
  qualquer alteração indevida derruba o teste.

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
