# Guia de manutenção

Este guia responde a duas perguntas: **o que mudar** e **onde mudar**. Consulte antes de mexer
no código e atualize sempre que criar um arquivo, uma ação ou uma regra nova.

Outros documentos:

- [COMO_TESTAR.md](COMO_TESTAR.md): passo a passo para rodar e testar o jogo.
- [HISTORICO.md](HISTORICO.md): o que mudou em cada etapa e em quais arquivos.
- [README.md](../README.md): visão geral e comandos.

## 1. Como o jogo é montado

O código é dividido em camadas. Cada camada só conhece as que estão acima dela nesta lista:

| Camada | Pasta | O que tem | Pode importar de |
|---|---|---|---|
| Tipagens | `src/types` | O formato de tudo (estado, definições, eventos) | nada |
| Dados | `src/data` | Números e textos do jogo, sem lógica | `types` |
| Ferramentas | `src/utils` | Sorteios, formatação, Base64, comparação | `types` |
| Motor | `src/engine` | As regras do jogo, em TypeScript puro | `types`, `data`, `utils` |
| Store | `src/store` | Estado global, ações, salvamento, laço | tudo acima |
| Tela | `src/components`, `src/App.tsx` | O que aparece | tudo acima |

Regras que mantêm isso de pé:

- **Número de balanceamento mora em `src/data`.** O motor não tem número solto.
- **Regra mora em `src/engine`.** O motor não importa React, não lê o `window` e não lê o
  relógio: quem chama passa o horário.
- **A store só coordena.** Ela copia o estado, chama o motor e grava o resultado.
- **A tela só lê a store e chama ações.** Nenhuma conta de jogo dentro de componente.

## 2. O caminho de um tick

1. `src/store/gameLoop.ts` chama `tick(Date.now())` a cada 100 ms.
2. `tick`, em `src/store/useGameStore.ts`, mede o tempo desde `lastSaveTimestamp`.
3. Até 2 minutos: `advanceSimulation` (em `src/engine/simulation.ts`) simula o intervalo.
4. Mais de 2 minutos: `applyOfflineProgress` (em `src/engine/offline.ts`) simula com teto e
   eficiência reduzida e devolve o relatório, que vai para `offlineReport`.
5. A store grava o estado novo. O `persist` do Zustand entrega para `saveManager.ts`, que grava
   no `localStorage` no máximo a cada 5 segundos.
6. Os componentes que leem os campos alterados são redesenhados.

Uma ação da pessoa (comprar, trocar a comitiva) passa por `applyInput`, na store: primeiro roda
um `tick` até o instante do clique, depois aplica a mudança.

## 3. Quero mudar... onde eu mexo?

### Conteúdo e balanceamento (só dados)

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

### Regras (motor)

| Quero mudar | Arquivo |
|---|---|
| Uma fórmula (vida, Patacas, XP, dano, custo, Raízes) | `src/engine/formulas.ts` |
| Ordem dos golpes, derrota, chamada do chefe, fim do tempo do chefe | `src/engine/simulation.ts` |
| O que um inimigo derrotado entrega (Patacas, XP, itens, Rastros) | `src/engine/simulation.ts`, bloco "Recompensas" |
| Dano direto fora do ritmo dos ataques (clique, teste) | `src/engine/simulation.ts`, `dealDirectDamage` |
| Como melhorias, sinergias e Raízes se combinam | `src/engine/modifiers.ts` |
| Dia, noite e fases da lua | `src/engine/clock.ts` |
| O que um pacto exige e o que acontece ao fechar | `src/engine/pact.ts` |
| Cálculo do progresso offline e junção de relatórios | `src/engine/offline.ts` |
| Estado de um jogo novo, entrada de inimigo em campo | `src/engine/state.ts` |

### Estado, ações e salvamento (store)

| Quero mudar | Arquivo |
|---|---|
| O que o `tick` faz e quando conta como ausência | `src/store/useGameStore.ts`, bloco "Ações de simulação" |
| Ações da pessoa: comitiva, melhorias, pactos, estágios, chefe | `src/store/useGameStore.ts`, bloco "Ações de jogo" |
| Exportar, importar, apagar tudo, gravar agora | `src/store/useGameStore.ts`, bloco "Ações de salvamento" |
| Atalhos de teste do painel de debug | `src/store/useGameStore.ts`, bloco "Ações de teste" |
| Chave do `localStorage`, formato do código exportado, mensagens de erro | `src/store/saveManager.ts` |
| Conferência de um salvamento lido ou importado | `src/store/saveManager.ts`, bloco "Conferência do salvamento" |
| Conversão de salvamentos de versões antigas | `src/store/saveManager.ts`, `MIGRATIONS` |
| Quando o laço roda, quando grava ao esconder ou fechar a aba | `src/store/gameLoop.ts` |
| Comportamento com duas abas abertas | `src/store/tabGuard.ts` |

### Tela

| Quero mudar | Arquivo |
|---|---|
| Painel de debug: métricas, botões, seções | `src/components/DebugView.tsx` |
| O que o jogo mostra ao abrir | `src/App.tsx` |
| Como números, porcentagens e durações aparecem | `src/utils/format.ts` |
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
3. Se o bioma for novo, inclua em `BiomeId`, em `src/types/game.ts`.

### Acrescentar uma melhoria

1. Crie a entrada em `src/data/upgrades.ts`. O campo `stat` diz o que ela altera.
2. Se o atributo ainda não existe, inclua em `ModifierStat` (`src/types/game.ts`), some em
   `src/engine/modifiers.ts` e use no ponto certo de `src/engine/simulation.ts`.

### Acrescentar um campo ao estado salvo

Todos os passos são obrigatórios. Pular um deles perde o campo ao salvar ou quebra saves antigos.

1. `src/types/game.ts`: declare o campo em `GameState`.
2. `src/engine/state.ts`: dê o valor inicial em `createInitialState` e inclua em `pickGameState`.
3. `src/store/saveManager.ts`: trate o campo em `sanitizeGameState`.
4. Se o formato de um campo antigo mudou: suba `saveVersion` em `src/data/balance.ts` e
   registre a conversão em `MIGRATIONS`.
5. Acrescente um caso no teste de salvamento, em `src/__tests__/store.test.ts`.

Campo que só existe com o jogo aberto (não é salvo) vai em `SessionState`, na store.

### Acrescentar uma ação na store

1. Declare em `GameActions`, em `src/store/useGameStore.ts`.
2. Escreva uma função que recebe o `draft` e devolve `true` quando deu certo.
3. Ligue no bloco certo usando `applyInput`, para a ação simular até o instante do clique.
4. Se a regra for de jogo, a conta fica em `src/engine` e a store só chama.

### Acrescentar algo ao painel de debug

- Métrica: uma linha na lista `metrics` da seção.
- Botão: uma linha na lista `actions` da seção.
- Seção: escreva o componente e acrescente uma linha em `SECTIONS`.

## 5. Padrão dos arquivos

- Todo arquivo abre com um cabeçalho: o que faz e o mapa dos blocos.
- Cada bloco é aberto por duas réguas de `=` e um título espaçado.
- Função curta, com uma linha de comentário dizendo o que ela faz.
- Constantes no topo do arquivo ou em `src/data/balance.ts`.
- Nomes do código em inglês. Comentários e textos de tela em português.
- Linhas com até 100 colunas.

## 6. O que atualizar junto com o código

A cada mudança, confira esta lista antes de enviar:

- [ ] Cabeçalho e mapa do arquivo alterado continuam certos.
- [ ] Arquivo novo ou responsabilidade nova: entrou nas tabelas da seção 3 deste guia e na
      estrutura do `README.md`.
- [ ] Mudou o que dá para testar na tela: `docs/COMO_TESTAR.md` atualizado.
- [ ] Entrada nova em `docs/HISTORICO.md`, com o que mudou e em quais arquivos.
- [ ] Decisão de design nova: registrada no GDD do projeto.
- [ ] Teste automático cobrindo a mudança, e `npm test`, `npm run typecheck` e `npm run lint`
      sem erro.
