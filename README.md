# Encantados

Idle de coleção com folclore brasileiro, para navegador. Você percorre os biomas com uma
comitiva de encantados (Saci, Curupira, Iara, Caipora, Boitatá) e enfrenta as visagens do
Estio. Roda inteiro no navegador e salva no `localStorage`.

Estado atual: MVP jogável com o primeiro sistema de retenção. Motor, estado global e interface
de produção prontos, com uma zona (Mata Atlântica), cinco encantados, melhorias, pactos,
amuletos, salvamento e progresso offline.

O visual segue o folheto de cordel: página de papel pardo, painéis de papel jornal e a arena
como capa do folheto, em papel colorido (uma cor por bioma) com as figuras em xilogravura.

## Documentação

- [docs/GUIA_DE_MANUTENCAO.md](docs/GUIA_DE_MANUTENCAO.md): o que mudar e onde mudar.
- [docs/COMO_TESTAR.md](docs/COMO_TESTAR.md): passo a passo para rodar e testar.
- [docs/HISTORICO.md](docs/HISTORICO.md): o que mudou em cada etapa.

Toda mudança no código atualiza esses três documentos. A lista do que conferir está na seção 6
do guia de manutenção.

## Como rodar

```bash
npm install
npm run dev        # abre o jogo em http://localhost:5173 (painel de debug em /?debug)
npm test           # roda os testes dos dados, do domínio, da store, do painel e da arquitetura
npm run typecheck  # confere as tipagens
npm run build      # gera a versão final em dist/
```

## Como o código está dividido

```
src/
  domain/              regras de negócio puras, sem React, sem relógio e sem sorteio próprio
    types.ts           entidades e tipagens do jogo
    catalog.ts         consulta dos dados por id e zona de cada estágio
    formulas.ts        contas de vida, Patacas, XP, custo e Raízes
    clock.ts           dia, noite e lua a partir de um horário
    modifiers.ts       junta melhorias, sinergias, amuletos e Raízes
    state.ts           jogo novo e combate contra visagem ou chefe
    simulation.ts      combate: avança qualquer intervalo de tempo
    actions.ts         regras das ações da pessoa (comitiva, melhorias, chefe, estágio)
    pact.ts            confere e fecha pactos
    amulets.ts         amuletos: queda, atributos, mochila, vestir, desmanche e entalhe
    offline.ts         ganhos do tempo ausente
  data/                datasets estáticos e tipados, sem função e sem cálculo
    balance.ts         constantes das fórmulas (ritmo do jogo)
    encantados.ts      encantados e seus pactos
    enemies.ts         visagens e chefes, com as tabelas de itens
    items.ts           Oferendas
    upgrades.ts        melhorias compradas com Patacas
    synergies.ts       bônus de origem da comitiva
    zones.ts           zonas, estágios e Rastros
    amulets.ts         tipos e raridades de amuleto
    index.ts           ponto único de importação dos datasets
  store/               estado global (Zustand), tempo e salvamento
    types.ts           tipagens da store: ações, estado de sessão, retornos
    useGameStore.ts    a store: tick e ações, que só chamam o domínio
    selectors.ts       dados prontos para a tela, com reaproveitamento de resultado
    eventViews.ts      eventos de combate traduzidos em golpes e linhas de registro
    saveManager.ts     gravação, exportação, importação e conferência do salvamento
    gameLoop.ts        liga o tick e grava ao esconder ou fechar a aba
    tabGuard.ts        garante que só uma aba cuida do jogo
  components/          componentes visuais burros
    GameScreen.tsx     a tela do jogo: cabeçalho, arena, abas laterais e janelas
    theme.ts           cor do papel de cada bioma e textos de origem, raridade e relógio
    header/            cabeçalho: recursos, zona e estágio, controles de salvamento
    arena/             capa com o inimigo, barras de ataque, números flutuantes e registro
    party/             comitiva, sinergias e Almanaque de pactos
    progress/          melhorias, navegação de estágios e amuletos
    modals/            janelas: escolha inicial, boas-vindas de volta, salvamento, outra aba
    ui/                peças reutilizáveis: figura, barras, botão e abas
    art/               xilogravuras em SVG
    hooks/             barra movida por ref e escuta dos eventos de combate
    DebugView.tsx      painel de debug: métricas, indicador de tick, ausência e controles
  utils/               funções utilitárias puras
    format.ts          números grandes, porcentagem, bônus com sinal, plural, duração e horário
    random.ts          sorteios (simples e por peso) e gerador com semente
    id.ts              gerador de identificador único
    object.ts          comparação de objetos
    base64.ts          Base64 com acentos
  App.tsx              liga o laço do jogo e mostra a tela
tests/                 testes automáticos, incluindo o que vigia a arquitetura
docs/                  guia de manutenção, roteiro de teste e histórico
```

As regras de cada pasta estão na seção 1 do guia de manutenção. Em resumo: número mora em
`src/data`, regra mora em `src/domain` como função pura, a store só coordena e os componentes
só mostram. O teste `tests/architecture.test.ts` falha se alguma dessas regras for quebrada.

## Como o tempo funciona

O jogo não confia no `setInterval`. O campo `lastSaveTimestamp` marca até onde o estado já foi
simulado. Cada `tick` mede o tempo real que passou desde então e simula exatamente esse
intervalo:

- até 2 minutos: conta como jogo aberto e rende 100%, mesmo que a aba esteja em segundo plano;
- mais de 2 minutos: conta como ausência. Rende 50%, com teto de 8 horas, e gera o relatório
  de "bem-vindo de volta" em `offlineReport`.

A simulação pula de evento em evento (próximo golpe ou fim do tempo do chefe). Por isso a mesma
função serve para 0,1 segundo e para 8 horas.

Toda ação da pessoa (comprar, trocar a comitiva, fechar pacto) primeiro simula o jogo até o
instante do clique e só depois é aplicada. Assim uma compra nunca vale para o tempo que já
passou.

O laço usa `setInterval`, não `requestAnimationFrame`, porque o segundo para em abas
escondidas. O desenho fica com o React e com CSS.

## Salvamento

- Gravação automática no `localStorage`, no máximo uma vez a cada 5 segundos, e na hora ao
  esconder ou fechar a aba.
- `exportSave()` devolve um código em Base64. `importSave(codigo)` troca o jogo atual pelo do
  código. `hardReset()` apaga tudo.
- Todo salvamento lido ou importado passa por uma conferência que descarta ids desconhecidos e
  valores inválidos.
- Só uma aba cuida do jogo. Se ele for aberto em outra aba, a antiga para de simular e de
  gravar (`isOpenInAnotherTab`) e a nova continua de onde o salvamento parou.
- Mudou o formato do `GameState`? Suba `saveVersion` em `balance.ts` e registre a conversão em
  `MIGRATIONS`, dentro de `saveManager.ts`.
- O salvamento está na versão 2. Um jogo gravado na versão 1 (antes dos amuletos) abre
  normalmente: ele ganha mochila vazia e zero Cavacos e passa a ser gravado na versão 2. O
  mesmo vale para um código exportado na versão 1.

## Amuletos

O primeiro sistema de retenção. Chefes vencidos (60% de chance) e visagens (1,5%) deixam
amuletos, em quatro raridades. Cada amuleto tem um bônus principal, que vem do tipo, e de zero
a três bônus secundários, conforme a raridade. Quanto mais alto o estágio, mais forte ele cai.

- Cada encantado veste um amuleto. Só vale o de quem está na comitiva.
- A mochila guarda 20. Com ela cheia, o que cair vira Cavacos.
- Desmanchar um amuleto rende Cavacos. Cavacos pagam o entalhe, que fortalece o amuleto.
- O desmanche automático transforma em Cavacos, na hora, o que cair até a raridade escolhida.

As regras ficam em `src/domain/amulets.ts`, os números em `src/data/amulets.ts` e em
`src/data/balance.ts`, e a tela em `src/components/progress/AmuletsPanel.tsx`.

## Árvore de componentes

```
App                          liga o laço do jogo e escolhe a tela
├─ GameScreen                tela do jogo
│  ├─ AppHeader
│  │  ├─ ResourceBar         Patacas, Raízes, Cavacos e Oferendas
│  │  ├─ StageBadge          zona, estágio e relógio do sertão
│  │  └─ SaveMenu            Exportar, Importar e Apagar tudo
│  │     └─ ExportModal, ImportModal, ResetModal
│  ├─ ArenaPanel             centro
│  │  ├─ EnemyCover          capa do folheto
│  │  │  ├─ EnemyFigure      xilogravura e nome do inimigo
│  │  │  ├─ EnemyHealth      barra de vida
│  │  │  ├─ BossTimer        tempo do chefe (barra por ref)
│  │  │  ├─ BossTrack        visagens até o chefe
│  │  │  └─ FloatingTextLayer  números que sobem (fora do React)
│  │  ├─ AttackBars          barras de ataque (por ref)
│  │  └─ EventLog            registro compacto
│  ├─ Tabs "Comitiva"        lateral esquerda
│  │  ├─ PartyPanel          elenco e sinergias
│  │  └─ AlmanacPanel        pactos
│  ├─ Tabs "Progresso"       lateral direita
│  │  ├─ UpgradesPanel       melhorias
│  │  ├─ StagesPanel         estágios e chefe
│  │  └─ AmuletsPanel        amuletos: quem veste, mochila, entalhe e desmanche
│  └─ StarterModal, OfflineModal, OtherTabNotice
└─ DebugView                 painel de debug, em /?debug
```

Como a tela se mantém leve:

- Cada componente lê da store só o que mostra, por um seletor que devolve a mesma referência
  enquanto o conteúdo não muda. Em 30 segundos de jogo (300 ticks) a tela inteira redesenha
  cerca de 30 vezes, acompanhando os golpes, e não os ticks.
- As barras de ataque e a do tempo do chefe andam por ref e transição de CSS. O componente
  delas não redesenha.
- Os números flutuantes e o tranco do inimigo são feitos direto no elemento, com animação de
  CSS.

## Painel de debug

Abra `/?debug`. O `DebugView` lê tudo direto da store e não liga o laço (isso é do `App`).
Para adaptar:

- nova métrica: uma linha na lista `metrics` da seção;
- novo botão: uma linha na lista `actions` da seção;
- nova seção: escreva o componente e acrescente uma linha em `SECTIONS`;
- mostrar só algumas seções: `<DebugView sectionIds={['loop', 'save']} />`.

Os botões de teste usam as ações `debugHitEnemy`, `debugGrantGold`, `debugSkipTime` e
`debugGrantAmulet` da store.

## Próximas etapas

1. Rebrota (prestígio), com as Raízes.
2. Novos biomas, com visagens, chefes e encantados próprios.
3. Lua nos pactos, laços e bônus do Almanaque.
4. Som, com a Web Audio API.
