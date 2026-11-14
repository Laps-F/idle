# Encantados

Idle de coleção com folclore brasileiro, para navegador. Você percorre os biomas com uma
comitiva de encantados (Saci, Curupira, Iara, Caipora, Boitatá) e enfrenta as visagens do
Estio. Roda inteiro no navegador e salva no `localStorage`.

Estado atual: motor e estado global prontos. A interface ainda é uma tela provisória de
conferência.

## Como rodar

```bash
npm install
npm run dev        # abre o jogo em http://localhost:5173
npm test           # roda os testes do motor, dos dados e da store
npm run typecheck  # confere as tipagens
npm run build      # gera a versão final em dist/
```

## Como o código está dividido

```
src/
  types/game.ts        todas as tipagens
  data/                números e textos do jogo, sem lógica
    balance.ts         constantes das fórmulas (ritmo do jogo)
    encantados.ts      encantados e seus pactos
    enemies.ts         visagens e chefes, com as tabelas de itens
    items.ts           Oferendas
    upgrades.ts        melhorias compradas com Patacas
    synergies.ts       bônus de origem da comitiva
    zones.ts           zonas, estágios e Rastros
    index.ts           consulta das definições por id
  engine/              regras do jogo em TypeScript puro, sem React
    formulas.ts        contas de vida, Patacas, XP, custo e Raízes
    clock.ts           dia, noite e lua a partir do horário do aparelho
    modifiers.ts       junta melhorias, sinergias e Raízes
    state.ts           estado inicial e entrada de inimigos
    simulation.ts      combate: avança qualquer intervalo de tempo
    pact.ts            confere e fecha pactos
    offline.ts         ganhos do tempo ausente
  store/
    useGameStore.ts    estado global (Zustand), tick e ações
    saveManager.ts     gravação, exportação, importação e conferência do salvamento
    gameLoop.ts        liga o tick e grava ao esconder ou fechar a aba
  utils/               sorteios, comparação de objetos e Base64
  __tests__/           testes automáticos
  App.tsx              tela provisória de conferência
```

A regra da casa: número de balanceamento mora em `src/data`, regra mora em `src/engine`, e a
store só coordena. Para mudar o ritmo do jogo, mexa em `src/data/balance.ts`.

## Como o tempo funciona

O jogo não confia no `setInterval`. O campo `lastSaveTimestamp` marca até onde o estado já foi
simulado. Cada `tick` mede o tempo real que passou desde então e simula exatamente esse
intervalo:

- até 2 minutos: conta como jogo aberto e rende 100%, mesmo que a aba esteja em segundo plano;
- mais de 2 minutos: conta como ausência. Rende 50%, com teto de 8 horas, e gera o relatório
  de "bem-vindo de volta" em `offlineReport`.

A simulação pula de evento em evento (próximo golpe ou fim do tempo do chefe). Por isso a mesma
função serve para 0,1 segundo e para 8 horas.

## Salvamento

- Gravação automática no `localStorage`, no máximo uma vez a cada 5 segundos, e na hora ao
  esconder ou fechar a aba.
- `exportSave()` devolve um código em Base64. `importSave(codigo)` troca o jogo atual pelo do
  código. `hardReset()` apaga tudo.
- Todo salvamento lido ou importado passa por uma conferência que descarta ids desconhecidos e
  valores inválidos.
- Mudou o formato do `GameState`? Suba `saveVersion` em `balance.ts` e registre a conversão em
  `MIGRATIONS`, dentro de `saveManager.ts`.

## Próximas etapas

1. Interface em painéis: comitiva, arena, melhorias e Almanaque.
2. Modal de volta, menu de salvamento e números flutuantes.
3. Lua nos pactos, equipamentos e Rebrota.
