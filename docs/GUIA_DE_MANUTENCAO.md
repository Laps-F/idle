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
| `src/domain` | Regras de negócio puras: entidades, combate, fórmulas, escalonamento, pactos, progresso offline | `data`, `utils` |
| `src/store` | Estado global (Zustand): o `tick`, o controle do tempo, o salvamento no `localStorage` e os seletores | `domain`, `data`, `utils`, Zustand |
| `src/data` | Datasets estáticos e tipados: inimigos, itens, zonas, tabelas de itens, constantes | só os tipos de `domain` |
| `src/components` | Componentes visuais "burros": mostram o que recebem e chamam ações | `store`, `utils`, React |
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
| Como melhorias, sinergias e Raízes se combinam | `src/domain/modifiers.ts` |
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
| Atalhos de teste do painel de debug | `src/store/useGameStore.ts`, bloco "Ações de teste" |
| Os dados prontos que um componente recebe | `src/store/selectors.ts` |
| Chave do `localStorage`, formato do código exportado, mensagens de erro | `src/store/saveManager.ts` |
| Conferência de um salvamento lido ou importado | `src/store/saveManager.ts`, bloco "Conferência do salvamento" |
| Conversão de salvamentos de versões antigas | `src/store/saveManager.ts`, `MIGRATIONS` |
| Quando o laço roda, quando grava ao esconder ou fechar a aba | `src/store/gameLoop.ts` |
| Comportamento com duas abas abertas | `src/store/tabGuard.ts` |

### Tela (`src/components`) e ferramentas (`src/utils`)

| Quero mudar | Arquivo |
|---|---|
| Painel de debug: métricas, botões, seções | `src/components/DebugView.tsx` |
| O que o jogo mostra ao abrir | `src/App.tsx` |
| Como números, porcentagens e durações aparecem | `src/utils/format.ts` |
| Sorteios e gerador com semente | `src/utils/random.ts` |
| Gerador de identificador único | `src/utils/id.ts` |
| Estilo global | `src/index.css` (Tailwind) |

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
4. Se o formato de um campo antigo mudou: suba `saveVersion` em `src/data/balance.ts` e
   registre a conversão em `MIGRATIONS`.
5. Acrescente um caso no teste de salvamento, em `tests/store.test.ts`.

Campo que só existe com o jogo aberto (não é salvo) vai em `SessionState`, em
`src/store/types.ts`.

### Mostrar um dado novo na tela

1. Acrescente o campo na visão certa de `src/store/selectors.ts` (ou crie uma visão nova com
   `createStableSelector`). É aqui que entram as consultas a `data` e as contas do `domain`.
2. No componente, leia com `useGameStore(seletor)` e só formate o valor.

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
- Linhas com até 100 colunas.

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
