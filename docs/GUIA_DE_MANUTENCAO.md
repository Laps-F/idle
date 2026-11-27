# Guia de manutenção

Este guia responde a duas perguntas: **o que mudar** e **onde mudar**. Consulte antes de mexer
no código e atualize sempre que criar um arquivo, uma ação ou uma regra nova.

Outros documentos:

- [COMO_TESTAR.md](COMO_TESTAR.md): passo a passo para rodar e testar o jogo.
- [HISTORICO.md](HISTORICO.md): o que mudou em cada etapa e em quais arquivos.
- [SPRITES.md](SPRITES.md): as imagens que faltam no mapa e onde colocar cada uma.
- [README.md](../README.md): visão geral e comandos.

## 1. Arquitetura

### As cinco pastas de `src`

| Pasta | O que tem | Pode importar de |
|---|---|---|
| `src/domain` | Regras de negócio puras: entidades, combate, fórmulas, escalonamento, pactos, amuletos, Rebrota, progresso offline, expedições | `data`, `utils` |
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
- `simulation.ts` e `rewards.ts` trabalham, por dentro, em uma cópia privada do estado (o
  `draft`, dentro de `RewardContext`). As funções internas alteram só essa cópia. Por fora,
  `advanceSimulation`, `dealDirectDamage` e `rewardExpeditionBag` são puras. `expeditionScene.ts` faz o
  mesmo com a cena do mapa em `advanceScene`, e `expeditionProjectiles.ts` só altera essa cena de
  trabalho.

**`src/data` só tem dados.**

- Nenhuma função e nenhum cálculo. Para consultar um dado por id, use `src/domain/catalog.ts`.
- Importa de `domain` apenas tipos (`import type`), para tipar os datasets.

**`src/store` só coordena.**

- Pega o estado atual, chama uma função pura do domínio, recebe o estado novo e grava.
- O estado é atualizado de forma imutável: nada é alterado no lugar.
- É a única camada que lê o relógio e o sorteio, e passa os dois para o domínio.
- Exceção única: `src/store/tuning.ts` (ajustes de teste) troca números direto nos objetos de
  `src/data`, a pedido da pessoa, e guarda o valor original de cada um para desfazer.
- Tudo que vem de fora (`localStorage`, código colado) entra como `unknown` e só vira
  `GameState` depois de passar por `sanitizeGameState`.

**`src/components` é burro.**

- Lê a store por seletores de `src/store/selectors.ts` (e `src/store/expeditionSelectors.ts`,
  para a expedição), que já entregam os dados prontos (nomes resolvidos, custos calculados).
  Chama ações da store.
- Não importa `domain` nem `data` e não faz conta de jogo. Só formata texto com `src/utils`.
- **Seletores granulares.** Nunca `useGameStore()` sem seletor. Cada componente lê só o que
  mostra: um valor simples (`useGameStore((store) => store.buyUpgrade)`) ou uma visão de
  `selectors.ts`, que devolve a mesma referência enquanto o conteúdo não muda.
- **Alta frequência fora do React.** O que muda a cada tick (barra de ataque, tempo do chefe)
  não passa por estado nem por seletor de React. O componente usa `LiveMeter`, que escuta a
  store por fora e escreve o `transform` direto no elemento. A transição de CSS suaviza o
  movimento. Números flutuantes e o tranco do inimigo também são feitos direto no elemento.
- **O mapa da expedição é desenhado no canvas.** `ExpeditionCanvas.tsx` lê a store com
  `getState()` a cada quadro do navegador e chama `mapRenderer.ts`. Nada do mapa passa por estado
  do React.

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

O jogo tem duas partes, e o tick anda com uma de cada vez:

- **Clareira**: o combate por estágios, com o jogo aberto ou fechado. Só rende com a comitiva
  na clareira, ou seja, sem expedição em andamento.
- **Expedição**: a parte ativa. Só existe enquanto há uma em andamento (campo `expedition` do
  estado salvo). Enquanto ela existe, a clareira fica parada, inclusive com a expedição pausada.
  Na volta, a garantia da clareira paga pelo menos o que a clareira teria rendido no tempo
  andado (`src/domain/expeditionGuarantee.ts`).

### Clareira (todo tick sem expedição)

1. `src/store/gameLoop.ts` chama `tick(Date.now())` a cada 100 ms (16 ms durante a expedição).
2. `tick`, em `src/store/useGameStore.ts`, mede o tempo desde `lastSaveTimestamp`.
3. Até 2 minutos: chama `advanceSimulation` (`src/domain/simulation.ts`), que devolve o estado
   novo, o resumo e os eventos.
4. Mais de 2 minutos: chama `applyOfflineProgress` (`src/domain/offline.ts`), que simula com
   teto e eficiência reduzida e devolve o estado novo e o relatório.
5. A store grava o estado novo. O `persist` do Zustand entrega para `saveManager.ts`, que grava
   no `localStorage` no máximo a cada 5 segundos.
6. Os seletores de `src/store/selectors.ts` montam as visões. Só o componente cuja visão mudou
   de conteúdo é redesenhado.

Uma ação da pessoa (comprar, trocar a comitiva, partir em expedição) passa por `applyInput`, na
store: primeiro roda um `tick` até o instante do clique, depois chama a regra do domínio e grava
o estado que ela devolveu.

### Expedição (por cima da clareira)

As ações e o passo do mapa ficam em `src/store/expeditionSession.ts`. `useGameStore.ts` só junta
essas ações às outras e chama o passo dentro do `tick`.

1. A pessoa parte pela aba "Expedições" (`startExpedition`): o estado ganha `expedition` (mapa,
   quem saiu e a bolsa vazia) e a sessão ganha a cena (`createExpeditionScene`, em
   `src/domain/expeditionScene.ts`). `src/App.tsx` troca a clareira pela tela da expedição.
2. O teclado (`src/components/hooks/useExpeditionKeyboard.ts`) grava a direção em `moveInput`
   (`setMoveInput`) e o pedido de golpe especial em `isSpecialPending` (`triggerSpecial`).
3. Em cada tick, depois da clareira, `runExpeditionTick`:
   - calcula quem anda e bate (`getExpeditionFighter`, em `src/domain/expedition.ts`) e avança a
     cena (`advanceScene`), que devolve a cena nova, as visagens derrotadas, os eventos e, se for
     o caso, como a expedição terminou;
   - guarda as derrotas na bolsa (`addKillsToLoot`). A bolsa é salva, a cena não.
4. A expedição termina no fim do tempo (`concluida`), quando a vida zera (`caiu`), na passagem
   de volta ou no botão (`voltou`), ou numa recarga no meio dela (`interrompida`).
   `endExpedition` chama `finishExpedition`, que entrega a bolsa pelo saque próprio do mapa
   (`rewardExpeditionBag`, em `src/domain/expeditionLoot.ts`, com a tabela de
   `src/data/expeditionLoot.ts` e bônus só em `concluida`), e guarda o relatório em
   `expeditionReport`.
5. `src/components/expedition/ExpeditionCanvas.tsx` desenha a cena a cada quadro do navegador,
   lendo `readSceneFrame` e `selectExpeditionMapView` (`src/store/expeditionSelectors.ts`). Os eventos de `sceneEvents` viram
   números que sobem.

**Pausa.** Com `isExpeditionPaused` (campo de sessão, não salvo), `runExpeditionTick` não anda
com a cena: tempo, ondas, recargas, visagens e projéteis param, e a clareira também. Pausa ao
esconder a aba e ao trocar de janela (`src/store/gameLoop.ts`), pela tecla P e numa ausência com
a cena ainda na memória (`holdExpeditionDuringAbsence`). Só continua pela pessoa: qualquer tecla
(`useExpeditionKeyboard.ts`) ou um clique no aviso (`ExpeditionCanvas.tsx`), que chamam
`resumeExpedition`. Durante a pausa, a direção e o golpe especial pedidos são ignorados.

O golpe comum da expedição é um projétil que voa pelo mapa (`projectiles`, na cena). Ele sai
sozinho na visagem mais perto e para na primeira que acerta. Os projéteis somem ao bater em árvore
ou água, ou depois da distância máxima.

O golpe especial (espaço) é o de quem está em campo. Cada encantado tem o seu em
`src/data/specials.ts`, como uma lista de efeitos (`SpecialEffect`, em `src/domain/types.ts`):
projétil que atravessa e pode queimar (Boitatá), empurrão em volta (Saci), tempo sem levar golpe
(Saci), visagens sem a pista (Curupira), visagens lentas (Caipora), cura (Iara) e pegada na hora
(Caipora). Quem aplica cada efeito é `src/domain/expeditionSpecials.ts`, que também faz andar os
estados das visagens (`slowSeconds`, `confusedSeconds`, `burnSeconds`) a cada passo. Sem a pista,
a visagem passeia em vez de perseguir e não bate. Lenta, faz tudo mais devagar. A queimadura bate
a cada meio segundo. O dano dos efeitos conta sobre o dano do golpe comum, e a Brasa no bornal
multiplica por cima. A recarga é a do golpe (`cooldownSeconds`) vezes a do preparo, e a cena
guarda a recarga inteira em `specialCooldownTotal`, para a barra. Um encantado sem golpe nos dados
solta o projétil padrão, com `specialDamageMultiplier` e `specialCooldownSeconds` de
`src/data/balance.ts`.

Para criar um efeito novo: some o tipo em `SpecialEffect`, o caso em `applyEffect`
(`expeditionSpecials.ts`) e, se ele deixar um estado na visagem, o campo em `SceneEnemy`, o passo
em `updateEnemyStatus`, o valor inicial em `spawnEnemy` (`expeditionScene.ts`) e o sinal na tela
(`SceneEnemyFrame` e `drawEnemyStatus`, em `mapRenderer.ts`).

## 3. Quero mudar... onde eu mexo?

### Conteúdo e balanceamento (`src/data`)

| Quero mudar | Arquivo |
|---|---|
| Ritmo geral: vida, Patacas e XP por estágio, crítico, dano por nível | `src/data/balance.ts` |
| Teto e eficiência do progresso offline, limite que conta como ausência | `src/data/balance.ts` |
| Intervalo do tick e intervalo de gravação | `src/data/balance.ts` |
| Tamanho da comitiva | `src/data/balance.ts` |
| Duração do dia e do ciclo da lua | `src/data/balance.ts` |
| Tempo da expedição e bônus de quem aguenta até o fim | `src/data/balance.ts`, `expeditionDurationSeconds` e `expeditionCompletionBonus` |
| Personagem na expedição: velocidade, vida, alcance, golpe especial padrão | `src/data/balance.ts`, bloco "Expedições: personagem" |
| Golpe especial de cada encantado: nome, texto, recarga, dano, raio, duração dos efeitos | `src/data/specials.ts`, `SPECIALS` |
| Quantos golpes uma visagem aguenta no nível de partida (a escala da expedição) | `src/data/balance.ts`, `expeditionHitsPerEnemy` |
| Projéteis: velocidade, tamanho e distância máxima (comum e especial) | `src/data/balance.ts`, bloco "Expedições: projéteis" |
| Visagens na expedição: perseguição, encostada, dano (fração da vida e crescimento), passeio, distância ao nascer | `src/data/balance.ts`, bloco "Expedições: visagens" |
| Pegadas: intervalo, quantas no chão, chance na visagem derrotada, distância para pegar e para surgir; quanto a clareira ainda dá de Rastro (`clearingTrailMultiplier`) | `src/data/balance.ts`, bloco "Expedições: pegadas de Rastro" |
| Ondas: visagens no começo, teto, ritmo de chegada, nível subindo com o tempo | `src/data/balance.ts`, bloco "Expedições: ondas" |
| Desenho de um mapa, bônus de nível (`levelBonus`), visagens que aparecem, início e passagem de volta | `src/data/world.ts`, `EXPEDITION_MAPS` |
| Saque de um mapa: Patacas e XP por visagem, Oferendas que caem, chance de amuleto | `src/data/expeditionLoot.ts`, `EXPEDITION_LOOT` |
| Preparos antes de partir: nome, texto, custo em Oferendas e o que mudam | `src/data/expeditionPreparations.ts`, `EXPEDITION_PREPARATIONS` |
| Tipos de ladrilho: símbolo no desenho e se dá para passar | `src/data/world.ts`, `TILES` |
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
| O que um inimigo derrotado entrega (Patacas, XP, itens, Rastros) | `src/domain/rewards.ts`, `grantKillRewards` |
| Uma peça de recompensa sozinha (Patacas, XP e nível, Oferenda, Rastro, amuleto) | `src/domain/rewards.ts`, bloco "Peças de recompensa" |
| Dano direto fora do ritmo dos ataques (clique, teste) | `src/domain/simulation.ts`, `dealDirectDamage` |
| Regras das ações da pessoa: comitiva, compra de melhoria, chefe, troca de estágio | `src/domain/actions.ts` |
| Como melhorias, sinergias, amuletos e Raízes se combinam | `src/domain/modifiers.ts` |
| Sorteio da queda e geração dos atributos de um amuleto | `src/domain/amulets.ts`, bloco "Queda" |
| O que acontece com o amuleto que cai (mochila cheia, desmanche automático) | `src/domain/amulets.ts`, `receiveAmulet` |
| Regras de vestir, tirar, desmanchar e entalhar | `src/domain/amulets.ts` |
| Em que momento do combate o amuleto cai | `src/domain/rewards.ts`, `rollAmulet` (chamado por `grantKillRewards`) |
| Quanto a Rebrota rende, quando libera, quando o juazeiro aparece | `src/domain/rebrota.ts`, blocos 1 e 2 |
| O que fica e o que volta ao começo na Rebrota, atalho e bolsa herdada | `src/domain/rebrota.ts`, `performRebrota` |
| Compra automática de melhorias (como escolhe o que comprar) | `src/domain/rebrota.ts`, `autoBuyUpgrades` |
| Em que momento a compra automática roda | `src/domain/rewards.ts`, `runAutoBuy` |
| Custo dos nós, Raízes livres e compra de um nó | `src/domain/juazeiro.ts`, blocos 1 e 2 |
| Como o juazeiro muda tempo do chefe, mochila e ausência | `src/domain/juazeiro.ts`, bloco "Regras que dependem do juazeiro" |
| Dia, noite e fases da lua | `src/domain/clock.ts` |
| O que um pacto exige e o que acontece ao fechar | `src/domain/pact.ts` |
| Cálculo do progresso offline e junção de relatórios | `src/domain/offline.ts` |
| Estado de um jogo novo, combate contra visagem ou chefe | `src/domain/state.ts` |
| Mapa, ladrilho de uma coluna e linha, tamanho do mapa, zona por id | `src/domain/catalog.ts` |
| Vida da personagem na expedição | `src/domain/formulas.ts`, `getExpeditionMaxHp` |
| Nível de partida pelo dano de quem sai, nível de cada mapa e das ondas, dano da encostada | `src/domain/expeditionScaling.ts` |
| Movimento e colisão da personagem, passagem de volta | `src/domain/expeditionScene.ts`, bloco "Personagem" |
| Ondas, passeio, perseguição e encostada das visagens | `src/domain/expeditionScene.ts`, bloco "Visagens" |
| Quando o projétil comum e o especial saem, e para onde | `src/domain/expeditionScene.ts`, bloco "Golpes" |
| O que cada efeito de golpe especial faz; lentidão, falta de pista e queimadura das visagens | `src/domain/expeditionSpecials.ts` |
| O que acontece com a visagem acertada (dano, derrota, bolsa) | `src/domain/expeditionScene.ts`, `damageEnemy` |
| Voo do projétil, acerto, atravessar visagens e fim (parede ou distância) | `src/domain/expeditionProjectiles.ts` |
| Colisão com árvore e água, distâncias, ladrilhos livres para nascer | `src/domain/sceneGeometry.ts` |
| Pegadas de Rastro: quando surgem, onde, de quem, como são pegas, pegada da visagem derrotada | `src/domain/expeditionFootprints.ts` |
| De quem as pegadas podem ser num mapa e quantas faltam (zona, hora, pacto, bolsa) | `src/domain/expedition.ts`, `getTrailTargets` |
| O que a cena recebe para começar (mapa, quem sai, pegadas, chance de Rastro, modificadores) | `src/domain/expedition.ts`, `getSceneSetup` |
| Modificadores da partida (preparo hoje; bênçãos e esquiva depois), pagar e conferir o preparo | `src/domain/expeditionModifiers.ts` |
| Partir com preparo (paga as Oferendas) | `src/domain/expedition.ts`, `startExpedition` |
| Quem sai primeiro (pôr um encantado em primeiro na comitiva) | `src/domain/actions.ts`, `setPartyLeader`; botões em `ExpeditionsPanel.tsx`, `LeaderPicker` |
| Clareira parada durante a expedição (o que o tick anda) | `src/store/useGameStore.ts`, `tick`; `src/store/expeditionSession.ts`, `runExpeditionTick` e `holdExpeditionDuringAbsence` |
| Garantia da clareira: quanto a clareira teria rendido | `src/domain/expeditionGuarantee.ts`, `getClearingReference` |
| Garantia da clareira: pagar a diferença na volta | `src/domain/expeditionLoot.ts`, `payGuarantee` (chamado por `rewardExpeditionBag`) |
| Tempo de expedição andado, salvo para a garantia numa recarga | `ExpeditionState.activeSeconds`, gravado em `runExpeditionTick` |
| Comparação com a clareira e a garantia na janela da volta | `src/components/modals/ExpeditionReportModal.tsx`, `describeComparison` |
| Entrega dos Rastros da bolsa na volta (sem passar do pacto) | `src/domain/expeditionLoot.ts`, `rewardExpeditionBag` |
| Ordem das coisas em cada passo e quando a expedição acaba | `src/domain/expeditionScene.ts`, `runStep` |
| Quem sai em expedição e com que números | `src/domain/expedition.ts`, `getExpeditionFighter` |
| Quando dá para partir | `src/domain/expedition.ts`, `canStartExpedition` e `startExpedition` |
| Como a bolsa junta as visagens | `src/domain/expedition.ts`, `addKillsToLoot` |
| O bônus de quem aguenta até o fim | `src/domain/expedition.ts`, `finishExpedition` |
| O que cada visagem da bolsa rende (ordem das peças de recompensa) | `src/domain/expeditionLoot.ts`, `rewardExpeditionBag` |

### Estado, ações e salvamento (`src/store`)

| Quero mudar | Arquivo |
|---|---|
| Lista de ações da store, campos de sessão, tipos de retorno | `src/store/types.ts` |
| O que o `tick` faz e quando conta como ausência | `src/store/useGameStore.ts`, bloco "Ações de simulação" |
| Partir, voltar, direção e golpe especial | `src/store/expeditionSession.ts`, bloco "Ações de expedição" |
| O passo da expedição dentro do tick e a entrega da bolsa | `src/store/expeditionSession.ts`, `runExpeditionTick` e `endExpedition` |
| Pausar e continuar a expedição | `src/store/expeditionSession.ts`, `pauseExpedition` e `resumeExpedition` |
| O que acontece com a expedição numa ausência (pausa ou "interrompida") | `src/store/expeditionSession.ts`, `holdExpeditionDuringAbsence` |
| Gravar o estado novo, aplicar uma entrada da pessoa, listas vazias únicas | `src/store/storeTools.ts` |
| Campos de sessão da expedição (cena, direção, golpe pedido, pausa, eventos, relatório) | `src/store/types.ts`, `SessionState` |
| Aba de expedições, painel, janela da volta e leitura de cada quadro | `src/store/expeditionSelectors.ts` |
| Seletor que reaproveita o resultado, listas com nome | `src/store/selectorTools.ts` |
| Conferência da expedição salva (mapa, quem saiu, bolsa) | `src/store/saveManager.ts`, `sanitizeExpedition` |
| Ligação entre uma ação e a regra do domínio | `src/store/useGameStore.ts`, bloco "Ações de jogo" |
| Exportar, importar, apagar tudo, gravar agora | `src/store/useGameStore.ts`, bloco "Ações de salvamento" |
| Ligação entre uma ação de amuleto e a regra do domínio | `src/store/useGameStore.ts`, bloco "Ações de amuletos" |
| Rebrotar, comprar nó, compra automática e a cerimônia | `src/store/useGameStore.ts`, bloco "Ações da Rebrota" |
| Atalhos de teste do painel de debug | `src/store/useGameStore.ts`, bloco "Ações de teste" |
| Os dados prontos que um componente recebe | `src/store/selectors.ts` (expedição: `src/store/expeditionSelectors.ts`) |
| Chave do `localStorage`, formato do código exportado, mensagens de erro | `src/store/saveManager.ts` |
| Conferência de um salvamento lido ou importado | `src/store/saveManager.ts`, bloco "Conferência do salvamento" |
| Conferência dos amuletos de um salvamento | `src/store/saveManager.ts`, `sanitizeAmulets` e `sanitizeEquipped` |
| Conferência do juazeiro de um salvamento | `src/store/saveManager.ts`, `sanitizeJuazeiro` |
| Conversão de salvamentos de versões antigas | `src/store/saveManager.ts`, `MIGRATIONS` |
| Quando o laço roda (e o intervalo mais curto na expedição), quando grava ao esconder ou fechar a aba, quando a expedição pausa sozinha | `src/store/gameLoop.ts` |
| Comportamento com duas abas abertas | `src/store/tabGuard.ts` |
| Quais números aparecem no painel "Ajustes", o nome, o grupo, o passo e o mínimo de cada um | `src/store/tuning.ts` |
| Mudar, desfazer e o atalho de nível do painel "Ajustes" | `src/store/useGameStore.ts`, `setTuning`, `resetTuning` e `debugSetLeaderLevel` |

### Publicação

| Quero mudar | Arquivo |
|---|---|
| Pasta do site no GitHub Pages (base dos endereços do build) | `vite.config.ts`, `PAGES_BASE` |
| O que roda antes de publicar, versão do Node, quando publica | `.github/workflows/pages.yml` |

### Tela (`src/components`)

| Quero mudar | Arquivo |
|---|---|
| Qual tela abre (clareira, expedição ou painel de debug) | `src/App.tsx` |
| A disposição dos painéis da clareira, as abas de cada lateral, as janelas automáticas | `src/components/GameScreen.tsx` |
| Aba "Expedições" da clareira: texto, mapas e botão de partir | `src/components/expedition/ExpeditionsPanel.tsx` |
| Janela da volta de uma expedição | `src/components/modals/ExpeditionReportModal.tsx` |
| A disposição da tela da expedição | `src/components/expedition/ExpeditionScreen.tsx` |
| O canvas da expedição e os números que sobem | `src/components/expedition/ExpeditionCanvas.tsx` |
| Como o mapa é pintado: câmera, camadas (projéteis inclusos), painel de vida e tempo, tamanho do ladrilho | `src/components/expedition/mapRenderer.ts` |
| Arquivo de imagem e cor provisória de cada ladrilho, da personagem e das visagens | `src/components/expedition/sprites.ts` |
| Ligar as imagens de verdade ou tirar os nomes escritos nos blocos | `src/components/expedition/sprites.ts`, `LOAD_SPRITE_IMAGES` e `SHOW_SPRITE_LABELS` |
| Painel ao lado do mapa: bolsa, voltar agora, como jogar, legenda | `src/components/expedition/ExpeditionSidePanel.tsx` |
| Teclas da expedição (direção, golpe especial, pausa e quais teclas continuam) | `src/components/hooks/useExpeditionKeyboard.ts` |
| Aviso "Pausado" por cima do mapa | `src/components/expedition/ExpeditionCanvas.tsx`, `PauseNotice` |
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
| Painel "Ajustes": busca, grupos, campos, atalhos e o botão do cabeçalho | `src/components/debug/TuningPanel.tsx` |

Os dados que cada componente recebe vêm de `src/store/selectors.ts` e, na expedição, de
`src/store/expeditionSelectors.ts`. Os eventos de combate
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
4. Ligue a ação em `src/store/useGameStore.ts` (ou `src/store/expeditionSession.ts`, se for da
   expedição), usando `applyInput`.
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
bloco "amuletos e migração do salvamento", em `tests/store.test.ts`. O exemplo mais recente é a
expedição: `MIGRATIONS[4]` e o bloco "expedições e salvamento da versão 5".

Campo que só existe com o jogo aberto (não é salvo) vai em `SessionState`, em
`src/store/types.ts`.

### Mostrar um dado novo na tela

1. Acrescente o campo na visão certa de `src/store/selectors.ts` ou, se for da expedição, de
   `src/store/expeditionSelectors.ts` (ou crie uma visão nova com `createStableSelector`, de
   `src/store/selectorTools.ts`). É aqui que entram as consultas a `data` e as contas do `domain`.
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

### Acrescentar um preparo de expedição

1. Acrescente uma entrada em `src/data/expeditionPreparations.ts`: `id`, `name`, `description`,
   `cost` (Oferendas de `src/data/items.ts`) e `modifiers` (só o que muda; o resto vale 1).
2. Os efeitos possíveis são os campos de `RunModifiers` (`src/domain/types.ts`). A aba
   "Expedições" e o painel "Ajustes" mostram o preparo sozinhos.
3. Rode `npm test`. O teste de dados confere ids, Oferendas e efeitos.

### Acrescentar algo que muda uma partida (bênção, esquiva)

1. Ponha o efeito novo como campo de `RunModifiers` (`src/domain/types.ts`) e em
   `NEUTRAL_RUN_MODIFIERS` (`src/domain/expeditionModifiers.ts`), valendo 1.
2. Em `getRunModifiers`, multiplique os valores da nova fonte por cima do preparo.
3. Na cena, leia `draft.modifiers.<campo>` onde o número é usado, nunca o preparo direto.

### Acrescentar um mapa de expedição

1. Desenhe o mapa em `EXPEDITION_MAPS`, em `src/data/world.ts`: uma linha de texto por linha do
   mapa, todas do mesmo tamanho, com os símbolos de `TILES`. Feche as bordas com árvore ou água.
2. Preencha `zoneId` (de onde vêm os Rastros), `levelBonus` (níveis acima do poder de quem sai:
   0 é o mapa mais fácil), `start`, `exit` (a passagem de volta, perto do início) e `enemyIds`.
3. Dê o saque do mapa em `src/data/expeditionLoot.ts` (multiplicadores de Patacas e XP, chance
   de amuleto e Oferendas). Sem saque, o teste de dados falha.
4. Rode `npm test`. O teste de dados confere o desenho, os ids, o início, a passagem e o saque. A
   aba "Expedições" mostra o mapa sozinha.

### Acrescentar um tipo de ladrilho

1. `src/data/world.ts`: uma entrada em `TILES`, com um símbolo que nenhum outro usa.
2. `src/components/expedition/sprites.ts`: a vaga de imagem em `TILE_SPRITES`. Se for chão,
   inclua o id em `GROUND_TILE_IDS`, para não escrever o nome do arquivo em cada ladrilho.
3. `docs/SPRITES.md`: uma linha na lista.

### Trocar os blocos coloridos por imagens

O passo a passo está em [SPRITES.md](SPRITES.md). Em resumo: arquivos em `public/sprites/` e
`LOAD_SPRITE_IMAGES` ligado em `src/components/expedition/sprites.ts`.

### Mudar a dificuldade da expedição

- Morre rápido demais: `enemyContactHpFraction`, `enemyContactGrowth`, `enemyChaseSpeed` ou
  `waveMaxEnemiesStart` para baixo, ou `levelBonus` do mapa. A vida (`playerBaseHp`) não ajuda:
  a encostada é uma fração da vida máxima.
- Visagem aguenta golpes demais ou de menos: `expeditionHitsPerEnemy`.
- Fácil demais: `waveSpawnSpeedupPerMinute` e `waveMaxEnemiesPerMinute` para cima, ou
  `waveLevelUpSeconds` para baixo (visagens sobem de nível mais cedo).
- Golpe especial fraco ou forte: o golpe de cada encantado em `src/data/specials.ts`
  (`cooldownSeconds`, `damageMultiplier`, raios e durações). A distância da labareda é
  `specialProjectileMaxDistance`, em `src/data/balance.ts`.
- Acertar de longe demais ou de perto demais: `attackRange` e `projectileMaxDistance`.
- Bolsa rende pouco ou muito: `goldMultiplier`, `xpMultiplier`, `amuletChance` e `drops` do mapa,
  em `src/data/expeditionLoot.ts`, ou `expeditionCompletionBonus`. O `levelBonus` também muda o
  saque, porque o nível entra nas fórmulas. A meta medida está no cabeçalho de
  `src/data/expeditionLoot.ts`.
- Para testar jogando: botão "Ajustes" no cabeçalho, com todos esses números e o nível de quem
  sai em expedição.
- Para medir sem jogar: monte uma cena com `createExpeditionScene` e chame `advanceScene` em
  passos de 0,1 s, como no histórico da etapa das expedições.

### Acrescentar algo ao passo do mapa (uma regra nova na expedição)

1. Se precisa de dado novo na cena, inclua em `ExpeditionScene` ou `SceneEnemy`
   (`src/domain/types.ts`) e dê o valor inicial em `createExpeditionScene`
   (`src/domain/expeditionScene.ts`). A cena não é salva: não precisa de migração.
2. Escreva a regra alterando só o `draft` e chame em `runStep`
   (`src/domain/expeditionScene.ts`), na ordem certa. Regra que cresce (mais de umas poucas
   funções) vai num arquivo próprio em `src/domain`, como `expeditionProjectiles.ts`, e não
   dentro de `expeditionScene.ts`. Use a geometria de `sceneGeometry.ts`.
3. Se a tela precisa ver, acrescente em `SceneFrame` e `readSceneFrame`
   (`src/store/expeditionSelectors.ts`) e desenhe em `mapRenderer.ts`.
4. Teste em `tests/expedition.test.ts`, com a cena montada à mão e congelada (`createScene`).

### Acrescentar um sistema novo (o caminho que os amuletos seguiram)

Siga esta ordem. Cada passo só depende dos anteriores.

1. Domínio: tipos em `src/domain/types.ts` e um arquivo só do sistema em `src/domain`, com
   funções puras. Sorteio entra por parâmetro (`RandomSource`). Ação recusada devolve `null`.
2. Dados: tabelas em um arquivo novo de `src/data`, exportadas por `src/data/index.ts`, e as
   constantes em `balance.ts`. Consulta por id em `src/domain/catalog.ts`.
3. Store: campos em `GameState` (receita "Acrescentar um campo ao estado salvo"), ações em
   `GameActions` ligadas com `applyInput` (`src/store/storeTools.ts`), gatilho dentro de
   `src/domain/rewards.ts` (clareira) ou `src/domain/expeditionLoot.ts` (expedição) se o sistema
   reage a uma derrota, e a visão da tela em
   `src/store/selectors.ts`.
4. Tela: componente burro na pasta do assunto e a aba em `GameScreen.tsx`.
5. Testes: um arquivo de teste do domínio (`tests/amulets.test.ts` é o modelo), casos de
   salvamento em `tests/store.test.ts` e casos de tela em `tests/GameScreen.test.tsx`.

### Acrescentar um tipo de linha ao registro

1. O evento nasce em `src/domain/simulation.ts` ou `src/domain/rewards.ts`, e o tipo dele fica
   em `CombatEvent` (`src/domain/types.ts`).
2. Traduza o evento em `src/store/eventViews.ts`: tipo novo em `LogEntryKind` e um caso em
   `toLogEntry`. O TypeScript acusa se faltar.
3. Dê a frase e o ícone em `src/components/arena/EventLog.tsx`.

### Acrescentar um número ao painel "Ajustes"

- Constante nova em `src/data/balance.ts`: acrescente o campo em `BALANCE_FIELDS`, em
  `src/store/tuning.ts`, com grupo, nome, passo e mínimo. O `npm run typecheck` acusa constante
  sem campo. Constante técnica (laço, gravação) vai em `TECHNICAL_BALANCE_KEYS`.
- Número dentro de outro dado (encantado, visagem, mapa, zona, melhoria): use `createObjectField`
  no bloco "Campos dos outros dados". Item novo de uma lista já coberta (uma visagem nova, um
  mapa novo) entra sozinho.
- Para testar: abra "Ajustes", mude o número e confira o efeito. As mudanças valem para o que
  for calculado depois (visagens que nascem, próximo golpe, próxima expedição).
- Ajuste bom vira permanente trocando o valor no arquivo que aparece em "Mudanças ligadas".

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
