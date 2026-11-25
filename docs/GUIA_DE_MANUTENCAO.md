# Guia de manutenção

Este guia responde a duas perguntas: **o que mudar** e **onde mudar**. Consulte antes de mexer
no código e atualize sempre que criar um arquivo, uma ação ou uma regra nova.

Outros documentos:

- [COMO_TESTAR.md](COMO_TESTAR.md): passo a passo para rodar e testar o jogo.
- [HISTORICO.md](HISTORICO.md): o que mudou em cada etapa e em quais arquivos.
- [README.md](../README.md): visão geral e comandos.

## 1. Arquitetura

### As cinco pastas de `src`

| Pasta | O que tem | Pode importar de |
|---|---|---|
| `src/domain` | Regras de negócio puras: entidades, combate, fórmulas, escalonamento, pactos, amuletos, Rebrota, progresso offline | `data`, `utils` |
| `src/store` | Estado global (Zustand): o `tick`, o controle do tempo, o salvamento no `localStorage` e os seletores | `domain`, `data`, `utils`, Zustand |
| `src/data` | Datasets estáticos e tipados: inimigos, itens, zonas, amuletos, tabelas de itens, constantes | só os tipos de `domain` |
| `src/components` | Componentes visuais "burros": mostram o que recebem e chamam ações | `store`, `utils`, React, Lucide (ícones) |
| `src/utils` | Funções utilitárias puras: formatadores, sorteio, ids, comparação | nada |

Fora das pastas, `src` só tem `App.tsx`, `main.tsx` e `index.css`. Os testes ficam em `tests/`,
na raiz do projeto.

### Regras de cada pasta

**`src/domain` é puro.**

- Toda função recebe o que precisa por parâmetro e devolve um valor novo. Nenhuma altera o
  estado que recebeu.
- Não lê o relógio (`Date.now`), não sorteia por conta própria (`Math.random`), não toca no
  navegador (`window`, `document`, `localStorage`) e não escreve no console. O horário e a
  fonte de sorteio entram por parâmetro.
- Não importa React nem Zustand.
- Ação que não é permitida devolve `null`, em vez de lançar erro ou alterar algo.
- `simulation.ts` trabalha, por dentro, em uma cópia privada do estado (o `draft`). As funções
  internas alteram só essa cópia. Por fora, `advanceSimulation` e `dealDirectDamage` são puras.

**`src/data` só tem dados.**

- Nenhuma função e nenhum cálculo. Para consultar um dado por id, use `src/domain/catalog.ts`.
- Importa de `domain` apenas tipos (`import type`), para tipar os datasets.

**`src/store` só coordena.**

- Pega o estado atual, chama uma função pura do domínio, recebe o estado novo e grava.
- O estado é atualizado de forma imutável: nada é alterado no lugar.
- É a única camada que lê o relógio e o sorteio, e passa os dois para o domínio.
- Tudo que vem de fora (`localStorage`, código colado) entra como `unknown` e só vira
  `GameState` depois de passar por `sanitizeGameState`.

**`src/components` é burro.**

- Lê a store por seletores de `src/store/selectors.ts`, que já entregam os dados prontos
  (nomes resolvidos, custos calculados). Chama ações da store.
- Não importa `domain` nem `data` e não faz conta de jogo. Só formata texto com `src/utils`.
- **Seletores granulares.** Nunca `useGameStore()` sem seletor. Cada componente lê só o que
  mostra: um valor simples (`useGameStore((store) => store.buyUpgrade)`) ou uma visão de
  `selectors.ts`, que devolve a mesma referência enquanto o conteúdo não muda.
- **Alta frequência fora do React.** O que muda a cada tick (barra de ataque, tempo do chefe)
  não passa por estado nem por seletor de React. O componente usa `LiveMeter`, que escuta a
  store por fora e escreve o `transform` direto no elemento. A transição de CSS suaviza o
  movimento. Números flutuantes e o tranco do inimigo também são feitos direto no elemento.

**`src/utils` é puro e não depende de ninguém.**

### Regras de código

- **Tipagem estrita.** `any` é proibido. O `tsconfig.app.json` liga `strict` e
  `noUncheckedIndexedAccess`, e o lint tem a regra `typescript/no-explicit-any`.
- **Tipos explícitos** para entidades (`src/domain/types.ts`), estados e ações da store
  (`src/store/types.ts`) e payloads de salvamento (`PersistedSave` e `ExportedSave`, em
  `src/store/saveManager.ts`).
- **JSDoc** (parâmetros, retorno e casos de borda) em: utilitários complexos, algoritmos de
  dano e de progresso offline, e ações críticas da store. Função simples leva um comentário de
  uma linha.

### Quem vigia as regras

`tests/architecture.test.ts` lê os arquivos de `src` e falha se: aparecer uma pasta fora das
cinco, uma camada importar o que não pode, `src/data` tiver função, `src/domain` usar relógio,
sorteio, navegador ou console, ou aparecer `any`. Roda junto com `npm test`.

## 2. O caminho de um tick

1. `src/store/gameLoop.ts` chama `tick(Date.now())` a cada 100 ms.
2. `tick`, em `src/store/useGameStore.ts`, mede o tempo desde `lastSaveTimestamp`.
3. Até 2 minutos: chama `advanceSimulation` (`src/domain/simulation.ts`), que devolve o estado
   novo, o resumo e os eventos.
4. Mais de 2 minutos: chama `applyOfflineProgress` (`src/domain/offline.ts`), que simula com
   teto e eficiência reduzida e devolve o estado novo e o relatório.
5. A store grava o estado novo. O `persist` do Zustand entrega para `saveManager.ts`, que grava
   no `localStorage` no máximo a cada 5 segundos.
6. Os seletores de `src/store/selectors.ts` montam as visões. Só o componente cuja visão mudou
   de conteúdo é redesenhado.

Uma ação da pessoa (comprar, trocar a comitiva) passa por `applyInput`, na store: primeiro roda
um `tick` até o instante do clique, depois chama a regra do domínio (`src/domain/actions.ts`)
e grava o estado que ela devolveu.

## 3. Quero mudar... onde eu mexo?

### Conteúdo e balanceamento (`src/data`)

| Quero mudar | Arquivo |
|---|---|
| Ritmo geral: vida, Patacas e XP por estágio, crítico, dano por nível | `src/data/balance.ts` |
| Teto e eficiência do progresso offline, limite que conta como ausência | `src/data/balance.ts` |
| Intervalo do tick e intervalo de gravação | `src/data/balance.ts` |
| Tamanho da comitiva | `src/data/balance.ts` |
| Duração do dia e do ciclo da lua | `src/data/balance.ts` |
| Ataque, velocidade, origem, raridade, quadra ou pacto de um encantado | `src/data/encantados.ts` |
| Vida, Patacas, XP ou itens que uma visagem ou chefe deixa cair | `src/data/enemies.ts` |
| Nome e descrição de uma Oferenda | `src/data/items.ts` |
| Custo, bônus ou nível máximo de uma melhoria | `src/data/upgrades.ts` |
| Bônus de uma sinergia de origem | `src/data/synergies.ts` |
| Estágios de uma zona, inimigos, chefe, tempo do chefe, visagens até o chefe | `src/data/zones.ts` |
| Chance de Rastro de um encantado e em que hora ele aparece | `src/data/zones.ts` |
| Tipos de amuleto: nome, descrição, atributo principal e bônus base | `src/data/amulets.ts`, `AMULET_BASES` |
| Raridades de amuleto: peso no sorteio, força, bônus secundários, entalhe máximo, valor de desmanche | `src/data/amulets.ts`, `AMULET_RARITIES` |
| Chance de amuleto por chefe e por visagem, tamanho da mochila | `src/data/balance.ts`, constantes `amulet...` |
| Custo e ganho do entalhe, devolução no desmanche, ganho por estágio | `src/data/balance.ts`, constantes `carve...`, `salvage...` e `amulet...` |
| Nós do juazeiro: efeito por nível, nível máximo e custo | `src/data/juazeiro.ts`, `JUAZEIRO_NODES` |
| Nome e descrição dos galhos do juazeiro | `src/data/juazeiro.ts`, `JUAZEIRO_BRANCHES` |
| Raízes por estágio, bônus por Raiz, estágio da primeira Rebrota, mínimo de Raízes, margem do atalho, Patacas da bolsa herdada | `src/data/balance.ts`, constantes `roots...`, `rebrota...` e `startGoldKills` |

### Regras (`src/domain`)

| Quero mudar | Arquivo |
|---|---|
| O formato de uma entidade, do estado ou de um evento | `src/domain/types.ts` |
| Consulta de um dado por id, zona de um estágio | `src/domain/catalog.ts` |
| Uma fórmula (vida, Patacas, XP, dano, custo, Raízes) | `src/domain/formulas.ts` |
| Ordem dos golpes, derrota, chamada do chefe, fim do tempo do chefe | `src/domain/simulation.ts` |
| O que um inimigo derrotado entrega (Patacas, XP, itens, Rastros) | `src/domain/simulation.ts`, bloco "Recompensas" |
| Dano direto fora do ritmo dos ataques (clique, teste) | `src/domain/simulation.ts`, `dealDirectDamage` |
| Regras das ações da pessoa: comitiva, compra de melhoria, chefe, troca de estágio | `src/domain/actions.ts` |
| Como melhorias, sinergias, amuletos e Raízes se combinam | `src/domain/modifiers.ts` |
| Sorteio da queda e geração dos atributos de um amuleto | `src/domain/amulets.ts`, bloco "Queda" |
| O que acontece com o amuleto que cai (mochila cheia, desmanche automático) | `src/domain/amulets.ts`, `receiveAmulet` |
| Regras de vestir, tirar, desmanchar e entalhar | `src/domain/amulets.ts` |
| Em que momento do combate o amuleto cai | `src/domain/simulation.ts`, `rollAmulet` |
| Quanto a Rebrota rende, quando libera, quando o juazeiro aparece | `src/domain/rebrota.ts`, blocos 1 e 2 |
| O que fica e o que volta ao começo na Rebrota, atalho e bolsa herdada | `src/domain/rebrota.ts`, `performRebrota` |
| Compra automática de melhorias (como escolhe o que comprar) | `src/domain/rebrota.ts`, `autoBuyUpgrades` |
| Em que momento a compra automática roda | `src/domain/simulation.ts`, `runAutoBuy` |
| Custo dos nós, Raízes livres e compra de um nó | `src/domain/juazeiro.ts`, blocos 1 e 2 |
| Como o juazeiro muda tempo do chefe, mochila e ausência | `src/domain/juazeiro.ts`, bloco "Regras que dependem do juazeiro" |
| Dia, noite e fases da lua | `src/domain/clock.ts` |
| O que um pacto exige e o que acontece ao fechar | `src/domain/pact.ts` |
| Cálculo do progresso offline e junção de relatórios | `src/domain/offline.ts` |
| Estado de um jogo novo, combate contra visagem ou chefe | `src/domain/state.ts` |

### Estado, ações e salvamento (`src/store`)

| Quero mudar | Arquivo |
|---|---|
| Lista de ações da store, campos de sessão, tipos de retorno | `src/store/types.ts` |
| O que o `tick` faz e quando conta como ausência | `src/store/useGameStore.ts`, bloco "Ações de simulação" |
| Ligação entre uma ação e a regra do domínio | `src/store/useGameStore.ts`, bloco "Ações de jogo" |
| Exportar, importar, apagar tudo, gravar agora | `src/store/useGameStore.ts`, bloco "Ações de salvamento" |
| Ligação entre uma ação de amuleto e a regra do domínio | `src/store/useGameStore.ts`, bloco "Ações de amuletos" |
| Rebrotar, comprar nó, compra automática e a cerimônia | `src/store/useGameStore.ts`, bloco "Ações da Rebrota" |
| Atalhos de teste do painel de debug | `src/store/useGameStore.ts`, bloco "Ações de teste" |
| Os dados prontos que um componente recebe | `src/store/selectors.ts` |
| Chave do `localStorage`, formato do código exportado, mensagens de erro | `src/store/saveManager.ts` |
| Conferência de um salvamento lido ou importado | `src/store/saveManager.ts`, bloco "Conferência do salvamento" |
| Conferência dos amuletos de um salvamento | `src/store/saveManager.ts`, `sanitizeAmulets` e `sanitizeEquipped` |
| Conferência do juazeiro de um salvamento | `src/store/saveManager.ts`, `sanitizeJuazeiro` |
| Conversão de salvamentos de versões antigas | `src/store/saveManager.ts`, `MIGRATIONS` |
| Quando o laço roda, quando grava ao esconder ou fechar a aba | `src/store/gameLoop.ts` |
| Comportamento com duas abas abertas | `src/store/tabGuard.ts` |

### Publicação

| Quero mudar | Arquivo |
|---|---|
| Pasta do site no GitHub Pages (base dos endereços do build) | `vite.config.ts`, `PAGES_BASE` |
| O que roda antes de publicar, versão do Node, quando publica | `.github/workflows/pages.yml` |

### Tela (`src/components`)

| Quero mudar | Arquivo |
|---|---|
| Qual tela abre (jogo ou painel de debug) | `src/App.tsx` |
| A disposição dos painéis na tela, as abas de cada lateral, as janelas automáticas | `src/components/GameScreen.tsx` |
| Cor do papel de cada bioma, textos de origem, raridade, fase do dia e lua | `src/components/theme.ts` |
| Carimbo de cada raridade, texto de cada bônus e opções do desmanche automático | `src/components/theme.ts`, bloco "Amuletos" |
| Cores e fontes do tema, animações (número flutuante, tranco, carimbo, barras) | `src/index.css` |
| O que aparece no cabeçalho | `src/components/header/AppHeader.tsx` |
| Recursos do cabeçalho (Patacas, Raízes, Cavacos, Oferendas) | `src/components/header/ResourceBar.tsx` |
| Zona, estágio e relógio no cabeçalho | `src/components/header/StageBadge.tsx` |
| Botões de exportar, importar e apagar tudo | `src/components/header/SaveMenu.tsx` |
| Janelas de exportar, importar e apagar tudo (textos e confirmações) | `src/components/modals/SaveModals.tsx` |
| O que o painel central reúne | `src/components/arena/ArenaPanel.tsx` |
| Capa do folheto: inimigo, vida, tempo do chefe, caminho até o chefe | `src/components/arena/EnemyCover.tsx` |
| Barras de ataque da comitiva | `src/components/arena/AttackBars.tsx` |
| Números que sobem a cada golpe e a cada ganho | `src/components/arena/FloatingTextLayer.tsx` |
| Registro "O que aconteceu": frases, ícones e quantas linhas guarda | `src/components/arena/EventLog.tsx` |
| Cartões da comitiva e lista de sinergias | `src/components/party/PartyPanel.tsx` |
| Almanaque: folha de cada pacto e a lista do que falta | `src/components/party/AlmanacPanel.tsx` |
| Lista de melhorias e botão de compra | `src/components/progress/UpgradesPanel.tsx` |
| Navegação de estágios, avanço automático e desafio ao chefe | `src/components/progress/StagesPanel.tsx` |
| Aba de amuletos: quem veste, mochila, entalhe, desmanche e desmanche automático | `src/components/progress/AmuletsPanel.tsx` |
| Aba do juazeiro: Raízes, quadro da Rebrota, galhos e nós | `src/components/rebrota/JuazeiroPanel.tsx` |
| Desenho do juazeiro e como os galhos e as raízes crescem | `src/components/rebrota/JuazeiroTree.tsx` |
| Janela de confirmação da Rebrota (o que fica e o que recomeça) | `src/components/rebrota/RebrotaConfirmModal.tsx` |
| Cerimônia da edição nova | `src/components/rebrota/RebrotaCeremony.tsx` e as animações `.page-turn` e `.stamp-late` em `src/index.css` |
| Quando a aba do juazeiro aparece na lateral | `src/components/GameScreen.tsx`, `PartyTabs` |
| Janela de boas-vindas de volta | `src/components/modals/OfflineModal.tsx` |
| Janela de escolha do encantado inicial | `src/components/modals/StarterModal.tsx` |
| Aviso de jogo aberto em outra aba | `src/components/modals/OtherTabNotice.tsx` |
| Base de todas as janelas (fundo, foco, Esc) | `src/components/modals/Modal.tsx` |
| Desenho de um encantado, inimigo ou amuleto | `src/components/art/figures.tsx` |
| Como a figura é mostrada e o filtro de borda irregular | `src/components/ui/Figure.tsx` |
| Aparência das barras, dos botões e das abas | `src/components/ui/Meter.tsx`, `Button.tsx`, `Tabs.tsx` |
| Como uma barra anda sem redesenhar o componente | `src/components/hooks/useStoreMeter.ts` |
| Como um componente recebe os eventos de combate | `src/components/hooks/useCombatFeed.ts` |
| Painel de debug: métricas, botões, seções | `src/components/DebugView.tsx` |

Os dados que cada componente recebe vêm de `src/store/selectors.ts`. Os eventos de combate
viram golpes e linhas de registro em `src/store/eventViews.ts`.

### Ferramentas (`src/utils`)

| Quero mudar | Arquivo |
|---|---|
| Como números, porcentagens, bônus com sinal, plurais e durações aparecem | `src/utils/format.ts` |
| Sorteios (simples e por peso) e gerador com semente | `src/utils/random.ts` |
| Gerador de identificador único | `src/utils/id.ts` |

## 4. Receitas

### Acrescentar um encantado

1. Crie a entrada em `src/data/encantados.ts`, com `pact` preenchido (ou `isStarter: true`).
2. Se o pacto pede uma Oferenda nova, crie em `src/data/items.ts` e faça algum inimigo deixar
   cair em `src/data/enemies.ts`.
3. Acrescente o encantado em `encounters` de uma zona, em `src/data/zones.ts`, para ele deixar
   Rastros.
4. Rode `npm test`. O teste de dados acusa id que não existe, Oferenda sem inimigo que a
   entregue e encantado de pacto sem zona.

### Acrescentar uma zona

1. Crie as visagens e o chefe em `src/data/enemies.ts`.
2. Acrescente a zona no fim da lista de `src/data/zones.ts`. Os estágios são contados em
   sequência, então ela começa onde a anterior termina.
3. Se o bioma for novo, inclua em `BiomeId`, em `src/domain/types.ts`.

### Acrescentar uma melhoria

1. Crie a entrada em `src/data/upgrades.ts`. O campo `stat` diz o que ela altera.
2. Se o atributo ainda não existe, inclua em `ModifierStat` (`src/domain/types.ts`), some em
   `src/domain/modifiers.ts` e use no ponto certo de `src/domain/simulation.ts`.

### Acrescentar uma regra de ação (o que a pessoa pode fazer)

1. Escreva a regra em `src/domain/actions.ts` como função pura: recebe o estado e os dados da
   ação e devolve o estado novo, ou `null` se a ação não for permitida. Use `{ ...state }` para
   montar o estado novo. Nunca altere o estado recebido.
2. Documente com JSDoc, incluindo os casos em que devolve `null`.
3. Declare a ação em `GameActions`, em `src/store/types.ts`.
4. Ligue a ação em `src/store/useGameStore.ts`, usando `applyInput`.
5. Teste a regra em `tests/domain.test.ts` com o estado congelado (`deepFreeze`).

### Acrescentar um campo ao estado salvo

Todos os passos são obrigatórios. Pular um deles perde o campo ao salvar ou quebra saves antigos.

1. `src/domain/types.ts`: declare o campo em `GameState`.
2. `src/domain/state.ts`: dê o valor inicial em `createInitialState` e inclua em `pickGameState`.
3. `src/store/saveManager.ts`: trate o campo em `sanitizeGameState`.
4. Suba `saveVersion` em `src/data/balance.ts` e registre em `MIGRATIONS` a conversão a partir
   da versão anterior, dando ao campo novo o valor de quem nunca o teve. A chave de
   `MIGRATIONS` é a versão de origem: `MIGRATIONS[1]` leva um salvamento da versão 1 para a 2.
5. Acrescente um caso no teste de salvamento, em `tests/store.test.ts`, que abre um salvamento
   da versão anterior e confere que nada se perdeu.

O exemplo pronto é a entrada dos amuletos: `MIGRATIONS[1]`, em `src/store/saveManager.ts`, e o
bloco "amuletos e migração do salvamento", em `tests/store.test.ts`.

Campo que só existe com o jogo aberto (não é salvo) vai em `SessionState`, em
`src/store/types.ts`.

### Mostrar um dado novo na tela

1. Acrescente o campo na visão certa de `src/store/selectors.ts` (ou crie uma visão nova com
   `createStableSelector`). É aqui que entram as consultas a `data` e as contas do `domain`.
2. No componente, leia com `useGameStore(seletor)` e só formate o valor.

### Acrescentar um painel ou uma aba à tela

1. Monte a visão em `src/store/selectors.ts`, com `createStableSelector`. Junte só dados que
   mudam no mesmo ritmo.
2. Escreva o componente na pasta do assunto (`header`, `arena`, `party`, `progress`, `modals`).
   Ele lê com `useGameStore(seletor)`, chama ações da store e só formata.
3. Encaixe em `src/components/GameScreen.tsx`: como painel na grade ou como uma aba nova nas
   listas de `PartyTabs` ou `ProgressTabs`. Para avisar com um número na aba, acrescente a
   contagem em `selectBadges`.
4. Atualize a árvore de componentes no cabeçalho de `GameScreen.tsx` e a tabela da seção 3.
5. Teste em `tests/GameScreen.test.tsx`.

### Acrescentar uma barra que anda a cada tick

1. Crie uma função de leitura em `src/store/selectors.ts`, no bloco "Leituras de alta
   frequência". Ela recebe o retrato da store e devolve uma fração de 0 a 1.
2. No componente, use `<LiveMeter read={suaLeitura} />`. Se a leitura depende de uma prop,
   crie a função com `useMemo`, como em `AttackBars.tsx`.
3. Não leia esse valor com `useGameStore(...)`: isso redesenharia o componente 10 vezes por
   segundo.

### Acrescentar um tipo de amuleto

1. `src/data/amulets.ts`: acrescente a entrada em `AMULET_BASES`, com um atributo principal que
   nenhum outro tipo usa. O atributo precisa existir em `ModifierStat` (`src/domain/types.ts`).
2. `src/components/art/figures.tsx`: desenhe a figura e registre em `FIGURES` com o mesmo id.
3. Rode `npm test`. O teste de dados confere a tabela.

Atributo novo (um que ainda não existe em `ModifierStat`) pede mais três passos: somar o
atributo em `src/domain/modifiers.ts`, usá-lo na conta certa do domínio e dar o texto em
`BONUS_LABELS`, em `src/components/theme.ts`.

### Mudar a chance ou a força dos amuletos

- Cai amuleto demais ou de menos: `amuletBossDropChance` e `amuletCommonDropChance`, em
  `src/data/balance.ts`.
- Raridade aparece demais ou de menos: o campo `weight` de `AMULET_RARITIES`. Os pesos são
  proporções entre si e não precisam somar 100.
- Amuleto forte ou fraco demais: `baseBonus` do tipo, `bonusMultiplier` da raridade ou
  `amuletStageScaling` (ganho por estágio).
- Entalhe caro ou barato demais: `carveCostBase`, `carveCostGrowth` e `carveCostMultiplier`.

### Acrescentar um nó ao juazeiro

1. `src/data/juazeiro.ts`: acrescente a entrada em `JUAZEIRO_NODES`, no galho certo.
2. Se o efeito ainda não existe, inclua em `JuazeiroEffect` (`src/domain/types.ts`) e em
   `createEmptyJuazeiroBonuses` (`src/domain/juazeiro.ts`), e use o bônus onde ele vale: em
   `getModifiers` (`src/domain/modifiers.ts`) para dano e chances, ou numa regra do bloco
   "Regras que dependem do juazeiro".
3. Rode `npm test`. A aba mostra o nó sozinha.

### Mudar o ritmo da Rebrota

- Primeira Rebrota cedo ou tarde demais: `rebrotaFirstStage`, em `src/data/balance.ts`.
- Rebrotas seguintes frequentes demais: `rebrotaMinRoots`.
- Raízes demais ou de menos: `rootsStageDivisor` e `rootsExponent`. Mexer aqui muda também quanto
  as Raízes de quem já jogou valeriam numa Rebrota futura, porque o recorde é recalculado.
- Árvore rápida ou lenta demais: `costBase` e `costStep` de cada nó.
- Depois de mudar, simule várias edições antes de publicar, como está descrito no histórico.

### Acrescentar a figura de um encantado, inimigo ou amuleto

1. Desenhe em `src/components/art/figures.tsx`, na prancha de 120 por 120. A tinta é
   `currentColor` e os cortes usam os estilos `CUT` e `CUT_FILL`.
2. Registre em `FIGURES`, com o mesmo id usado em `src/data`. Sem registro, aparece a figura
   genérica.

### Acrescentar um sistema novo (o caminho que os amuletos seguiram)

Siga esta ordem. Cada passo só depende dos anteriores.

1. Domínio: tipos em `src/domain/types.ts` e um arquivo só do sistema em `src/domain`, com
   funções puras. Sorteio entra por parâmetro (`RandomSource`). Ação recusada devolve `null`.
2. Dados: tabelas em um arquivo novo de `src/data`, exportadas por `src/data/index.ts`, e as
   constantes em `balance.ts`. Consulta por id em `src/domain/catalog.ts`.
3. Store: campos em `GameState` (receita "Acrescentar um campo ao estado salvo"), ações em
   `GameActions` ligadas com `applyInput`, gatilho dentro de `src/domain/simulation.ts` se o
   sistema reage ao combate, e a visão da tela em `src/store/selectors.ts`.
4. Tela: componente burro na pasta do assunto e a aba em `GameScreen.tsx`.
5. Testes: um arquivo de teste do domínio (`tests/amulets.test.ts` é o modelo), casos de
   salvamento em `tests/store.test.ts` e casos de tela em `tests/GameScreen.test.tsx`.

### Acrescentar um tipo de linha ao registro

1. O evento nasce em `src/domain/simulation.ts` e o tipo dele fica em `CombatEvent`
   (`src/domain/types.ts`).
2. Traduza o evento em `src/store/eventViews.ts`: tipo novo em `LogEntryKind` e um caso em
   `toLogEntry`. O TypeScript acusa se faltar.
3. Dê a frase e o ícone em `src/components/arena/EventLog.tsx`.

### Acrescentar algo ao painel de debug

- Métrica: uma linha na lista `metrics` da seção.
- Botão: uma linha na lista `actions` da seção.
- Seção: escreva o componente e acrescente uma linha em `SECTIONS`.

## 5. Padrão dos arquivos

- Todo arquivo abre com um cabeçalho: o que faz e o mapa dos blocos.
- Cada bloco é aberto por duas réguas de `=` e um título espaçado.
- Função curta. JSDoc nas funções complexas ou críticas, comentário de uma linha nas simples.
- Constantes no topo do arquivo ou em `src/data/balance.ts`.
- Nomes do código em inglês. Comentários e textos de tela em português.
- Linhas com até 100 colunas. A exceção são os traçados das figuras em SVG.

## 6. O que atualizar junto com o código

A cada mudança, confira esta lista antes de enviar:

- [ ] Cabeçalho e mapa do arquivo alterado continuam certos.
- [ ] Arquivo novo ou responsabilidade nova: entrou nas tabelas da seção 3 deste guia e na
      estrutura do `README.md`.
- [ ] Função complexa ou ação crítica nova: tem JSDoc com parâmetros, retorno e casos de borda.
- [ ] Mudou o que dá para testar na tela: `docs/COMO_TESTAR.md` atualizado.
- [ ] Entrada nova em `docs/HISTORICO.md`, com o que mudou e em quais arquivos.
- [ ] Decisão de design nova: registrada no GDD do projeto.
- [ ] Teste automático cobrindo a mudança, e `npm test`, `npm run typecheck` e `npm run lint`
      sem erro. O `npm test` inclui o teste de arquitetura.
