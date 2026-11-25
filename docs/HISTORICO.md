# Histórico de mudanças

O que mudou em cada etapa e em quais arquivos. A entrada mais nova fica em cima.

## 25/11/2026: protótipo do mundo aberto

Começo da mudança de gênero escolhida no documento "pivo-gameplay-ativa" do projeto: o caminho A,
mundo aberto no estilo de Legends of Idleon. A personagem anda por mapas vistos de cima, bate
sozinha nas visagens que chegam perto e continua lutando com o jogo fechado. A tela principal
passou a ser o mundo aberto. A tela antiga continua em `?classico`. A Rebrota fica para ser
repensada depois. O salvamento subiu para a versão 4.

Tudo é protótipo: dois mapas, sem imagens (blocos coloridos com o nome do arquivo que vai entrar),
visagens que só passeiam e não batem, e só o primeiro da comitiva luta no mapa.

Domínio:

- `src/domain/world.ts` (novo): cena do mapa, movimento com colisão, passagens entre mapas,
  nascimento, passeio e volta das visagens, golpe automático, quem anda e bate
  (`getWorldFighter`) e o registro da posição (`recordWorldStep`).
- `src/domain/worldOffline.ts` (novo): ritmo do mapa (visagens por segundo) e os ganhos do
  tempo fora, com o teto e a eficiência de sempre.
- `src/domain/simulation.ts`: o bloco de recompensas passou a receber o estágio e a zona por
  parâmetro, e ganhou a função pública `rewardKills`, que entrega as recompensas das derrotas no
  mapa pelas mesmas regras.
- `src/domain/types.ts`: bloco "Mundo aberto" (ladrilho, mapa, passagem, cena, visagem no mapa,
  entrada, eventos). O `GameState` ganhou `world` (mapa e posição da personagem).
- `src/domain/catalog.ts`: `getZone`, `hasZone`, `getWorldMap`, `hasWorldMap`,
  `getFirstWorldMap`, `getTileAt` e `getMapSize`. `src/domain/state.ts`: `createStartPosition`.

Dados:

- `src/data/world.ts` (novo): quatro tipos de ladrilho e os mapas "Beira da Mata" (nível 1) e
  "Brejo Escuro" (nível 4), ligados por uma passagem.
- `src/data/balance.ts`: `saveVersion: 4` e o bloco do mundo aberto (velocidades, alcance,
  tamanho do corpo, passeio, volta das visagens, ritmo da ausência).

Store:

- `src/store/useGameStore.ts`: o tick roda um motor por vez (campo de sessão `engine`).
  `runWorldTick` anda com a cena e entrega as derrotas para `rewardKills`. A ausência usa a conta
  do mapa no motor `mundo`. Ações novas `setEngine` e `setWorldInput`.
- `src/store/types.ts`: `GameEngine` e os campos de sessão `engine`, `worldScene`, `worldInput`
  e `worldEvents`.
- `src/store/gameLoop.ts`: `startGameLoop(engine)`, com 16 ms no mundo aberto.
- `src/store/saveManager.ts`: `MIGRATIONS[3]` (versão 3 para 4) e `sanitizeWorld`.
- `src/store/selectors.ts`: bloco "Mundo aberto" com `selectWorldMapView`, `selectWorldHud` e
  `readWorldFrame`.

Tela:

- `src/components/world/` (nova pasta): `WorldScreen`, `WorldCanvas` (desenho no canvas, fora do
  React), `worldRenderer.ts` (câmera e camadas), `WorldSidePanel` e `sprites.ts` (o arquivo de
  imagem de cada coisa do mapa).
- `src/components/hooks/useWorldKeyboard.ts` (novo): setas e W, A, S e D.
- `src/App.tsx`: abre o mundo aberto por padrão, `?classico` para a tela antiga e `?debug` para
  o painel.
- `public/sprites/` (nova pasta) e `docs/SPRITES.md` (novo): onde entram as imagens e a lista de
  arquivos.

Testes:

- `tests/world.test.ts` (novo): montagem da cena, movimento, colisão, passagens, golpe, volta das
  visagens, recompensas e ausência no mapa.
- `tests/WorldScreen.test.tsx` (novo): escolha inicial, painel, legenda das imagens e teclado.
- `tests/data.test.ts`: mapas (desenho retangular, ladrilhos conhecidos, ids, início e
  passagens). `tests/store.test.ts`: salvamento da versão 3, passo e ausência no mapa, posição
  estragada ao importar.

## 25/11/2026: Rebrota e juazeiro

O prestígio do jogo, conforme o design aprovado (documento "design-rebrota" do projeto). O
salvamento subiu para a versão 3.

Domínio:

- `src/domain/rebrota.ts` (novo): Raízes que a Rebrota rende (só o que passa do recorde),
  quando libera, quando o juazeiro aparece, `performRebrota` (o que fica e o que recomeça) e a
  compra automática de melhorias.
- `src/domain/juazeiro.ts` (novo): custo dos nós, Raízes livres, compra de nó e o efeito dos
  nós em tempo do chefe, mochila e ausência.
- `src/domain/types.ts`: tipos do juazeiro. O `GameState` ganhou `juazeiro`, `edition`,
  `recordStage`, `editionSeconds` e `autoBuy`, e as estatísticas ganharam `bossesFailed`.
  `Modifiers` ganhou as chances de Rastro, de Oferenda e de amuleto, separadas da de achado.
  `OfflineReport` passou a guardar o teto e a eficiência que valeram. Evento novo: `rebrota`.
- `src/domain/modifiers.ts`, `simulation.ts`, `offline.ts`, `amulets.ts`, `state.ts`,
  `actions.ts`, `catalog.ts`: o juazeiro entra no dano, no crítico, nas chances, no tempo do
  chefe, na ausência e na mochila. A simulação conta o tempo da edição, os chefes perdidos e
  roda a compra automática a cada inimigo derrotado.

Dados:

- `src/data/juazeiro.ts` (novo): três galhos e treze nós.
- `src/data/balance.ts`: `saveVersion: 3`, `rebrotaMinRoots`, `rebrotaFirstStage`,
  `rebrotaWorthRatio`, `rebrotaStageMargin` e `startGoldKills`.

Store:

- `src/store/useGameStore.ts`: bloco "Ações da Rebrota" (rebrotar, comprar nó, ligar a compra
  automática, fechar a cerimônia) e a ação de teste `debugGrantRoots`. `applyInput` passou a
  aceitar campos de sessão gravados junto com o estado.
- `src/store/saveManager.ts`: `MIGRATIONS[2]` (versão 2 para 3) e `sanitizeJuazeiro`.
- `src/store/selectors.ts`: `selectJuazeiroPanel`, `selectIsJuazeiroRevealed`,
  `selectRebrotaCeremony`, a edição no cabeçalho, o aviso da aba e a Rebrota no relatório de
  volta.
- `src/store/types.ts`, `eventViews.ts`: ações novas, a cerimônia na sessão e a linha de registro.

Tela:

- `src/components/rebrota/` (nova pasta): `JuazeiroPanel`, `JuazeiroTree`,
  `RebrotaConfirmModal` e `RebrotaCeremony`.
- `GameScreen.tsx`: aba "Juazeiro" na lateral esquerda, só depois do primeiro muro, e a
  cerimônia. `AppHeader.tsx`: "Edição N". `EventLog.tsx`, `OfflineModal.tsx`, `DebugView.tsx`:
  linha da Rebrota, aviso no relatório de volta, métricas e botões de teste.
- `ui/Modal.tsx`: opção `panelClassName`. `src/index.css`: animações `.page-turn`,
  `.stamp-late` e `.branch-grow`, desligadas para quem pede movimento reduzido.

Testes:

- `tests/rebrota.test.ts` (novo): 25 testes das regras.
- `tests/store.test.ts`: salvamento da versão 2, Rebrota pela store, juazeiro guardado e
  juazeiro adulterado. `tests/GameScreen.test.tsx`: aba escondida e revelada, Rebrota com
  confirmação e cerimônia, compra de nó e chave da compra automática.

Calibragem (simulação de 8 horas, três sementes, jogando de forma perfeita):

- A primeira edição desacelera sozinha entre 25 e 30 minutos, por volta do estágio 37 a 43.
- Pedindo só 3 Raízes (estágio 21), a primeira Rebrota liberava aos 10 minutos,
  cedo demais. Passou a pedir o estágio 35 (`rebrotaFirstStage`) e agora libera entre 21 e
  23 minutos, o que deve dar 25 a 35 minutos para uma pessoa.
- Cada edição passa do recorde anterior em 7 a 13 minutos.
- Edição 4 ou 5 depois de 2 horas, estágio 77 a 88. Depois disso a única zona pesa: o
  progresso fica lento, o que reforça o Cerrado como próxima etapa de conteúdo.
- Com os números atuais, o atalho máximo começa no estágio 21, sempre abaixo do limite de 10
  estágios antes do recorde. O limite fica como proteção para números futuros.

## 25/11/2026: publicação no GitHub Pages

O jogo passa a abrir em https://laps-f.github.io/idle/.

- `.github/workflows/pages.yml` (novo): a cada envio para o `main`, roda lint, testes e build e
  publica a pasta `dist` no Pages.
- `vite.config.ts`: base `/idle/` no build e no `npm run preview`. O `npm run dev` continua em `/`.
- `index.html`: o ícone usa `%BASE_URL%`, para funcionar dentro da pasta `/idle/`.
- `README.md`, `docs/COMO_TESTAR.md`, `docs/GUIA_DE_MANUTENCAO.md`: endereço do site, como a
  publicação funciona e o que fazer se ela falhar.

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
