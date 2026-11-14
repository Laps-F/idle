# Encantados

Idle de coleção com folclore brasileiro, para navegador. Você percorre os biomas com uma
comitiva de encantados (Saci, Curupira, Iara, Caipora, Boitatá) e enfrenta as visagens do
Estio. Roda inteiro no navegador e salva no `localStorage`.

Estado atual: motor e estado global prontos. A tela ainda é o painel de debug
(`src/components/DebugView.tsx`), usado para validar o motor antes da interface final.

## Documentação

- [docs/GUIA_DE_MANUTENCAO.md](docs/GUIA_DE_MANUTENCAO.md): o que mudar e onde mudar.
- [docs/COMO_TESTAR.md](docs/COMO_TESTAR.md): passo a passo para rodar e testar.
- [docs/HISTORICO.md](docs/HISTORICO.md): o que mudou em cada etapa.

Toda mudança no código atualiza esses três documentos. A lista do que conferir está na seção 6
do guia de manutenção.

## Como rodar

```bash
npm install
npm run dev        # abre o jogo em http://localhost:5173
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
    modifiers.ts       junta melhorias, sinergias e Raízes
    state.ts           jogo novo e combate contra visagem ou chefe
    simulation.ts      combate: avança qualquer intervalo de tempo
    actions.ts         regras das ações da pessoa (comitiva, melhorias, chefe, estágio)
    pact.ts            confere e fecha pactos
    offline.ts         ganhos do tempo ausente
  data/                datasets estáticos e tipados, sem função e sem cálculo
    balance.ts         constantes das fórmulas (ritmo do jogo)
    encantados.ts      encantados e seus pactos
    enemies.ts         visagens e chefes, com as tabelas de itens
    items.ts           Oferendas
    upgrades.ts        melhorias compradas com Patacas
    synergies.ts       bônus de origem da comitiva
    zones.ts           zonas, estágios e Rastros
    index.ts           ponto único de importação dos datasets
  store/               estado global (Zustand), tempo e salvamento
    types.ts           tipagens da store: ações, estado de sessão, retornos
    useGameStore.ts    a store: tick e ações, que só chamam o domínio
    selectors.ts       dados prontos para a tela, com reaproveitamento de resultado
    saveManager.ts     gravação, exportação, importação e conferência do salvamento
    gameLoop.ts        liga o tick e grava ao esconder ou fechar a aba
    tabGuard.ts        garante que só uma aba cuida do jogo
  components/          componentes visuais burros
    DebugView.tsx      painel de debug: métricas, indicador de tick, ausência e controles
  utils/               funções utilitárias puras
    format.ts          números grandes, porcentagem, duração e horário
    random.ts          sorteios e gerador com semente
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

## Painel de debug

O `DebugView` lê tudo direto da store e não liga o laço (isso é do `App`). Para adaptar:

- nova métrica: uma linha na lista `metrics` da seção;
- novo botão: uma linha na lista `actions` da seção;
- nova seção: escreva o componente e acrescente uma linha em `SECTIONS`;
- mostrar só algumas seções: `<DebugView sectionIds={['loop', 'save']} />`.

Os botões de teste usam as ações `debugHitEnemy`, `debugGrantGold` e `debugSkipTime` da store.

## Próximas etapas

1. Interface em painéis: comitiva, arena, melhorias e Almanaque.
2. Modal de volta, menu de salvamento e números flutuantes.
3. Lua nos pactos, equipamentos e Rebrota.
