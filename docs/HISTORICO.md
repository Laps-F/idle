# Histórico de mudanças

O que mudou em cada etapa e em quais arquivos. A entrada mais nova fica em cima.

## 26/11/2026: preparos com Oferendas e modificadores da partida (Etapa 5 do Caminho 1)

Primeiro uso das Oferendas depois dos pactos: antes de partir, a pessoa pode pagar um preparo.

| Preparo | Custo | Efeito na partida |
|---|---|---|
| Favo no toco | 3 mel silvestre | visagens chegam 1,5 vez mais rápido e o teto sobe 1,5 vez |
| Trilha de cipó | 3 cipó trançado | pegadas surgem duas vezes mais rápido |
| Brasa no bornal | 1 brasa viva | golpe especial com o dobro de dano e recarga de 4 s (era 6) |

- Um preparo por expedição, opcional, pago ao partir. Não volta, nem se a expedição acabar cedo.
- Sem Oferendas bastantes, o preparo fica apagado na aba "Expedições", com o custo e quanto se
  tem. Escolher de novo desfaz a escolha.
- O preparo aparece no painel ao lado do mapa e na janela da volta.
- **Estrutura para a esquiva e as bênçãos:** tudo o que muda uma partida passa por um objeto só,
  `RunModifiers` (velocidade, dano e recarga do especial, ritmo e teto de visagens, ritmo das
  pegadas, dano recebido). `getRunModifiers` monta o objeto (hoje só do preparo) e a cena lê
  `draft.modifiers`, nunca o preparo direto. As bênçãos vão multiplicar por cima do mesmo objeto.
- O salvamento continua na versão 5. A expedição salva sem `preparationId`, ou com um preparo que
  não existe mais, abre sem preparo (o custo já tinha sido pago).

Medição: o robô das outras etapas cai em pouco mais de 1 minuto, e com 8 sementes a variação dele
é maior que o efeito dos preparos. Os testes confirmam que cada preparo faz o que promete, mas o
equilíbrio entre eles (por exemplo, se o Favo no toco compensa o perigo a mais) precisa de jogo
de verdade.

Arquivos:

- `src/data/expeditionPreparations.ts` (novo): `EXPEDITION_PREPARATIONS`. Exportado em
  `src/data/index.ts`.
- `src/domain/expeditionModifiers.ts` (novo): `NEUTRAL_RUN_MODIFIERS`, `getRunModifiers`,
  `canAffordPreparation` e `payPreparation`.
- `src/domain/types.ts`: `RunModifiers`, `ExpeditionPreparationDef`,
  `ExpeditionState.preparationId`, `SceneSetup.modifiers`, `ExpeditionScene.modifiers` e
  `ExpeditionReport.preparationId`.
- `src/domain/catalog.ts`: `getExpeditionPreparation` e `hasExpeditionPreparation`.
- `src/domain/expedition.ts`: `startExpedition` aceita o preparo e paga; `getSceneSetup` passa os
  modificadores; o relatório conta o preparo.
- `src/domain/expeditionScene.ts`: velocidade, dano recebido, ritmo e teto das ondas, recarga e
  dano do especial e ritmo das pegadas lidos de `draft.modifiers`.
- `src/store/expeditionSession.ts` e `src/store/types.ts`: `startExpedition(mapId, preparationId)`.
- `src/store/expeditionSelectors.ts`: lista de preparos com custo e se dá para pagar; o preparo no
  painel e na volta; a barra do especial segue a recarga modificada.
- `src/store/saveManager.ts`: confere `preparationId`.
- `src/store/tuning.ts`: grupo "Expedição: preparos com Oferendas".
- Tela: `ExpeditionsPanel.tsx` (escolha do preparo), `ExpeditionSidePanel.tsx` e
  `ExpeditionReportModal.tsx`.
- Testes: `tests/expedition.test.ts` (bloco "preparos com Oferendas"), `tests/data.test.ts`,
  `tests/store.test.ts` (partir com preparo, salvamento) e `tests/ExpeditionScreen.test.tsx`
  (escolher, partir, desfazer).
- Documentação: guia de manutenção (tabelas e duas receitas novas), `docs/COMO_TESTAR.md` (passos
  9e a 9i) e `README.md`.

Com isso o Caminho 1 está completo: pausa, escala, saque próprio, pegadas e preparos.

## 26/11/2026: pegadas de Rastro na expedição (Etapa 4 do Caminho 1)

A expedição virou a fonte principal de Rastros. A clareira continua dando alguns, para quem só
joga idle não travar nos pactos.

Regras:

- **Clareira e ausência:** a chance de Rastro de cada zona vale 15% do que valia
  (`clearingTrailMultiplier`).
- **Pegadas:** uma surge a cada 20 segundos (`footprintSpawnSeconds`, a primeira aos 10) num
  ladrilho livre a pelo menos 5 ladrilhos da personagem. No máximo 2 no chão
  (`footprintMaxOnMap`). Uma visagem derrotada deixa uma pegada onde caiu em 5% das vezes
  (`footprintDropChance`).
- **De quem:** só de encantados da zona do mapa que ainda precisam de Rastro para o pacto, na hora
  certa (o Boitatá só à noite). Nunca surge mais pegada do que falta, contando o que já está na
  bolsa. Pegada que fica no chão no fim da expedição se perde.
- **Chance de Rastro:** Olho de mateiro, sinergia da mata e Faro de mateiro encurtam o intervalo
  entre pegadas.
- **Pegar:** passar por cima (a 0,6 ladrilho). O Rastro vai para a bolsa, que é salva. Na volta,
  ele é entregue sem passar do que o pacto pede. Uma recarga no meio também entrega.
- **Tela:** bloco laranja pequeno escrito "Pegada: Caipora" (vaga `pegada.png`), "+1 Rastro" ao
  pegar, "Rastros" no painel de cima e "Rastros na bolsa" ao lado do mapa. A aba "Expedições"
  mostra de quem as pegadas podem ser em cada mapa e quantas faltam.

Ritmo medido (Saci com 15 minutos de jogo, de dia, doze sementes, com o pacto da Caipora pedindo
999 Rastros só na simulação, para o teto não atrapalhar a conta):

| Onde | Rastros por minuto |
|---|---|
| Clareira, antes | 0,99 |
| Clareira, agora | 0,18 |
| Expedição, robô que desvia e vai até as pegadas | 1,27 em média (de 0 a 4) |

A expedição rende em média quase 7 vezes mais que a clareira, dentro da meta de 5 a 10 vezes.
Com 10% na clareira, a diferença chegava a 20 vezes. Por isso ficou 15%. Na prática: só na
clareira, os 3 Rastros da Caipora levam uns 15 minutos; numa expedição, de 1 a 3 minutos.

Ponto a observar: depois dos dois pactos, nenhuma pegada surge, porque são só 8 Rastros no jogo
inteiro. As pegadas ganham peso quando houver mais encantados (Cerrado).

Arquivos:

- `src/domain/expeditionFootprints.ts` (novo): intervalo, surgir, pegar e a pegada da visagem
  derrotada.
- `src/domain/expeditionScene.ts`: `createExpeditionScene` recebe um `SceneSetup` (mapa, quem sai,
  de quem são as pegadas, chance de Rastro). O passo chama as pegadas e devolve `trails`.
- `src/domain/expedition.ts`: `getTrailTargets`, `getSceneSetup`, `addTrailsToLoot`,
  `countTrails`. A bolsa (`ExpeditionState.trails`) guarda os Rastros.
- `src/domain/expeditionLoot.ts`: `rewardExpeditionBag` (no lugar de `rewardExpeditionKills`)
  entrega visagens e Rastros. As visagens da expedição não sorteiam mais Rastro.
- `src/domain/rewards.ts`: `rollTrails` usa `clearingTrailMultiplier`.
- `src/domain/types.ts`: `TrailTarget`, `SceneFootprint`, `SceneSetup`, campos novos da cena, o
  evento `trail` e `SceneStepResult.trails`.
- `src/data/balance.ts`: bloco "Expedições: pegadas de Rastro".
- `src/store/saveManager.ts`: a bolsa salva sem `trails` (salvamento da versão 5 de antes) abre
  sem Rastros. O salvamento continua na versão 5.
- `src/store/expeditionSession.ts`: monta a cena por `getSceneSetup` e guarda os Rastros pegos.
- `src/store/expeditionSelectors.ts`: pegadas no quadro, Rastros na bolsa e de quem são as
  pegadas de cada mapa.
- `src/store/tuning.ts`: grupo "Expedição: pegadas de Rastro".
- Tela: `mapRenderer.ts`, `sprites.ts`, `ExpeditionCanvas.tsx`, `ExpeditionSidePanel.tsx` e
  `ExpeditionsPanel.tsx`.
- Testes: `tests/expedition.test.ts` (bloco "pegadas de Rastro"), `tests/domain.test.ts` (a
  clareira dá só uma fração), `tests/store.test.ts` (bolsa salva com e sem Rastros) e
  `tests/tuning.test.ts`.
- Documentação: guia de manutenção, `docs/SPRITES.md`, `docs/COMO_TESTAR.md` (passos 9b a 9d e
  13) e `README.md`.

## 26/11/2026: saque próprio da expedição (Etapa 3 do Caminho 1)

A bolsa deixou de usar as regras da clareira (`rewardKills`) e passou a ter uma tabela por mapa,
em `src/data/expeditionLoot.ts`:

| Mapa | Patacas e XP por visagem | Amuleto por visagem | Oferendas |
|---|---|---|---|
| Beira da Mata | 4 vezes a fórmula da clareira | 6% | mel 20% (1 a 2), cipó 12% |
| Brejo Escuro | 5 vezes | 8% | cipó 20% (1 a 2), mel 10%, brasa viva 4% |

- As fórmulas usam o nível da visagem no lugar do estágio, com os multiplicadores de sempre
  (Bolsa de couro, sinergias, amuletos, Raízes). O multiplicador de cada tipo de visagem também
  entra.
- As Oferendas vêm da tabela do mapa, para qualquer visagem. O Brejo Escuro é a primeira fonte
  de brasa viva fora do Corpo-Seco.
- O amuleto usa a chance do mapa, com a força do nível da visagem.
- Os Rastros continuam pelas regras da clareira, na zona do mapa, até a Etapa 4 (pegadas).
- O bônus de quem aguenta até o fim (50% a mais de visagens) continua igual.

Calibragem (Saci sozinho, cinco sementes, uma expedição comparada com 5 minutos de clareira no
mesmo momento do jogo):

| Momento | Beira, parado | Beira, desviando | Brejo, parado | Brejo, desviando |
|---|---|---|---|---|
| 1 min | 0,4 a 0,7 | 0,3 a 1,0 | 0,1 a 0,5 | 0,4 a 0,9 |
| 15 min | 0,6 a 0,7 | 0,5 a 1,7 (mediana 1,0) | 0,2 a 0,9 | 0,5 a 1,3 (mediana 0,9) |
| 60 min | 0,7 a 1,4 | 1,1 a 1,8 (mediana 1,3) | 0,3 a 1,4 | 0,9 a 2,2 (mediana 1,2) |

Os números são Patacas da expedição divididas pelas Patacas da clareira. O XP ficou na mesma
faixa. A meta (1 a 1,5 vez, para uma expedição boa) bate a partir dos 15 minutos. No primeiro
minuto rende menos, porque caem poucas visagens. Quem fica parado ganha menos do que quem joga.
Amuletos: cerca de 1 por expedição na Beira e, em média, de 0,6 a 3 no Brejo, contra 0 a 3 em 5 minutos de
clareira.

Arquivos:

- `src/data/expeditionLoot.ts` (novo): `EXPEDITION_LOOT`. Exportado em `src/data/index.ts`.
- `src/domain/expeditionLoot.ts` (novo): `rewardExpeditionKills`.
- `src/domain/expedition.ts`: `finishExpedition` usa `rewardExpeditionKills`.
- `src/domain/rewards.ts`: `grantKill` (Patacas, XP e contagem, comum à clareira e à
  expedição); `rollAmulet` aceita a chance do mapa; `rewardKills` saiu.
- `src/domain/amulets.ts`: `rollAmuletDrop` aceita `baseChance`.
- `src/domain/catalog.ts`: `getExpeditionLoot` e `hasExpeditionLoot`.
- `src/domain/types.ts`: `ExpeditionLootDef`.
- `src/store/tuning.ts`: grupo "Expedição: saque de cada mapa" no painel "Ajustes".
- Testes: `tests/expedition.test.ts` (bloco "saque próprio da expedição") e `tests/data.test.ts`
  (todo mapa tem saque válido).
- Documentação: guia de manutenção (tabelas e receitas), `docs/COMO_TESTAR.md` (passos 9 e 9a)
  e `README.md`. Salvamento continua na versão 5.

## 26/11/2026: escala da expedição pelo poder de quem sai (Etapa 2 do Caminho 1)

Antes, as visagens nasciam no nível fixo do mapa (1 e 4) e batiam um número fixo por nível. Com
o jogo andando, a expedição ficava fácil e rendia pouco. Agora a dificuldade acompanha a força de
quem sai.

Regras novas:

- **Nível de partida** = o maior nível em que uma visagem comum aguenta `expeditionHitsPerEnemy`
  (3) golpes de quem sai: 1 + piso(log(3 × dano ÷ 10) ÷ log(1,18)), no mínimo 1. Fica fixo
  durante a expedição. Melhorias, amuletos, sinergias, Raízes e o nível do encantado entram,
  porque estão no dano.
- **Mapas:** `level` virou `levelBonus`, somado ao nível de partida. Beira da Mata +0, Brejo
  Escuro +1 (era o nível 4 fixo; +3 deixou o Brejo pesado demais na medição abaixo).
- **Ondas:** continuam subindo 1 nível por minuto.
- **Encostada:** vida máxima × 3% (`enemyContactHpFraction`) × 1,15 (`enemyContactGrowth`) por
  nível acima da partida × multiplicador de vida da visagem. A vida maior de um encantado mais
  forte deixou de deixar a expedição mais fácil.
- A aba "Expedições" mostra o nível de cada mapa para quem sairia agora, e explica a escala.
- Como a bolsa usa o nível da visagem no lugar do estágio, ela já rende mais com a comitiva mais
  forte. O saque próprio da expedição é a Etapa 3.

Ritmo medido (Saci sozinho comprando melhorias sem parar, três sementes, um robô parado e um robô
que foge das visagens de perto e se aproxima das de longe):

| Momento | Nível de partida | Beira, parado | Beira, desviando | Brejo, parado | Brejo, desviando |
|---|---|---|---|---|---|
| 1 min de jogo | 2 a 3 | 1min40 a 3min40 | 1min10 a 2min | 10 a 45 s | 30 s a 4min10 |
| 15 min | 10 | 1min30 a 3min50 | 1min50 a 5 min | 12 s a 2min | 1min20 a 3 min |
| 60 min | 15 | 3 a 5 min | 1min40 a 2min40 | 15 s a 4 min | 3 a 3min40 |

O ponto principal: a Beira da Mata aguenta mais ou menos o mesmo tempo em qualquer momento do
jogo, quando antes ficava trivial. O robô desviando é fraco (entra em becos), então uma pessoa
deve durar mais. Cada expedição rendeu de 2 a 28 visagens, menos que o imaginado na análise
(150). Com 1 hora, a bolsa rende de 20% a 45% das Patacas de 5 minutos de clareira. Isso entra
na conta da Etapa 3.

Arquivos:

- `src/domain/expeditionScaling.ts` (novo): `getFighterBaseLevel`, `getMapStartLevel`,
  `getWaveLevel` (saiu de `expeditionScene.ts`) e `getEnemyContactDamage` (saiu de
  `formulas.ts`, com a fórmula nova).
- `src/domain/expeditionScene.ts`: `createExpeditionScene` recebe quem sai (vida e dano), em vez
  da vida. A cena guarda `baseLevel`.
- `src/domain/types.ts`: `ExpeditionMapDef.levelBonus` no lugar de `level`;
  `ExpeditionScene.baseLevel`.
- `src/data/balance.ts`: `expeditionHitsPerEnemy`, `enemyContactHpFraction` e
  `enemyContactGrowth` no lugar de `enemyDamageBase` e `enemyDamageGrowth`.
- `src/data/world.ts`: `levelBonus` 0 e 1.
- `src/store/expeditionSession.ts`: passa quem sai para a cena.
- `src/store/expeditionSelectors.ts`: nível de cada mapa pelo poder de quem sairia.
- `src/store/tuning.ts`: campos novos no painel "Ajustes" e o bônus de cada mapa.
- `src/components/expedition/ExpeditionsPanel.tsx`: texto da escala.
- Testes: `tests/expedition.test.ts` (nível de partida, bônus do mapa, ondas, encostada),
  `tests/tuning.test.ts` e `tests/data.test.ts`.
- Documentação: guia de manutenção, `docs/COMO_TESTAR.md` (passo 8a) e `README.md`. O salvamento
  continua na versão 5: o nível de partida fica na cena, que não é salva.

## 26/11/2026: pausa da expedição (Etapa 1 do Caminho 1)

A expedição continuava rodando com a aba escondida: a personagem ficava parada, apanhava e caía,
e depois de 2 minutos fora a expedição acabava como "interrompida". Agora ela pausa.

- Pausa ao esconder a aba, ao trocar de janela, pela tecla P e numa ausência longa com a cena
  ainda na memória (computador dormindo, por exemplo).
- Pausada, a cena não anda: tempo, ondas, recargas, visagens e projéteis param. A clareira
  continua rendendo.
- Só a pessoa continua: qualquer tecla ou um clique no aviso "Pausado". A tecla que continua não
  faz mais nada (o espaço não solta o especial). Shift, Ctrl, Alt e Tab sozinhos não continuam.
- "Interrompida" ficou só para a recarga da página no meio da expedição, quando a cena se perde.
- A pausa é só estado de sessão. O salvamento continua na versão 5.

Arquivos:

- `src/store/types.ts`: campo de sessão `isExpeditionPaused` e as ações `pauseExpedition` e
  `resumeExpedition`.
- `src/store/expeditionSession.ts`: as duas ações, `holdExpeditionDuringAbsence` (pausa ou
  "interrompida" numa ausência) e o passo do mapa parado durante a pausa. A direção e o golpe
  especial pedidos durante a pausa são ignorados.
- `src/store/useGameStore.ts`: o `tick` chama `holdExpeditionDuringAbsence` no lugar de encerrar a
  expedição. A pausa entra nos valores iniciais e no "apagar tudo" e "importar".
- `src/store/gameLoop.ts`: pausa ao esconder a aba e no `blur` da janela.
- `src/store/expeditionSelectors.ts`: `selectIsExpeditionPaused`.
- `src/components/hooks/useExpeditionKeyboard.ts`: tecla P e qualquer tecla para continuar.
- `src/components/expedition/ExpeditionCanvas.tsx`: aviso `PauseNotice` por cima do mapa.
- `src/components/expedition/ExpeditionSidePanel.tsx`: a pausa em "Como jogar".
- Testes: `tests/store.test.ts` (a ausência agora pausa; cena parada e volta; pausa sem
  expedição; voltar pausada) e `tests/ExpeditionScreen.test.tsx` (outra janela, aba escondida,
  tecla P, qual tecla continua, clique no aviso).
- Documentação: guia de manutenção, `docs/COMO_TESTAR.md` (passos 12a a 12e) e `README.md`.

## 26/11/2026: arrumação antes de ligar a clareira e a expedição (Etapa 0 do Caminho 1)

Antes de mexer na expedição (pausa, escala, saque próprio, pegadas e preparos), as partes que vão
mudar saíram dos arquivos grandes. O jogo se comporta igual: com a mesma semente, 30 minutos de
clareira e uma expedição inteira dão o mesmo resultado, byte a byte, antes e depois. O salvamento
continua na versão 5.

Domínio:

- `src/domain/rewards.ts` (novo): as peças de recompensa (`grantGold`, `grantXpToParty`,
  `rollItemDrops`, `grantItem`, `rollTrails`, `grantTrail`, `rollAmulet`, `runAutoBuy`), a
  recompensa completa de uma derrota (`grantKillRewards`), o contexto de trabalho
  (`RewardContext`, `createRewardContext`, `toResult`) e `rewardKills`, que saiu de
  `simulation.ts`. A clareira e a expedição passam a usar as mesmas peças.
- `src/domain/simulation.ts`: ficou só com o combate da clareira (de 611 para 345 linhas).
  `SimulationOptions` continua exportado daqui, vindo de `rewards.ts`.
- `src/domain/sceneGeometry.ts` (novo): `isWalkablePosition`, `listFreeTileCenters`, distâncias e
  centro de ladrilho, que estavam em `expeditionScene.ts`.
- `src/domain/expeditionProjectiles.ts` (novo): disparo e voo dos projéteis. Avisa o acerto por uma
  função (`onHit`), e a cena decide o que acontece com a visagem.
- `src/domain/expeditionScene.ts`: de 764 para 589 linhas.
- `src/domain/expedition.ts`: importa `rewardKills` de `rewards.ts`.

Store:

- `src/store/expeditionSession.ts` (novo): as ações de expedição, `runExpeditionTick` e
  `endExpedition`, que estavam em `useGameStore.ts`.
- `src/store/storeTools.ts` (novo): `commitState`, `applyInput`, os tipos `SetStore` e `GetStore`
  e as listas vazias únicas.
- `src/store/useGameStore.ts`: de 787 para 558 linhas.
- `src/store/expeditionSelectors.ts` (novo): o bloco "Expedições" de `selectors.ts` (aba, painel,
  janela da volta, `readSceneFrame`).
- `src/store/selectorTools.ts` (novo): `createStableSelector`, `toNamedAmounts` e `NamedAmount`.
- `src/store/selectors.ts`: de 1.295 para cerca de 1.000 linhas. Continua exportando `NamedAmount`.

Tela: os componentes da expedição (`App.tsx`, `ExpeditionCanvas`, `ExpeditionSidePanel`,
`ExpeditionsPanel`, `mapRenderer.ts` e `ExpeditionReportModal`) passaram a ler de
`expeditionSelectors.ts`.

Testes: `tests/expedition.test.ts` importa `isWalkablePosition` de `sceneGeometry.ts`. Nenhum teste
mudou de conteúdo.

Documentação: guia de manutenção (regras, caminho do tick, tabelas e receitas) e `README.md`.

## 26/11/2026: botão de fechar no painel "Ajustes"

O painel "Ajustes" só fechava pela tecla Esc, e sem botão parecia que não fechava nunca. Entrou
o botão "Fechar" ao lado de "Desfazer tudo" e outro no fim da janela.

- `src/components/debug/TuningPanel.tsx`: os dois botões.
- `tests/TuningPanel.test.tsx`: caso "fecha pelo botão Fechar".

## 26/11/2026: painel de ajustes de teste

Para testar a dificuldade sem mexer no código, entrou o painel "Ajustes", no cabeçalho da
clareira e da expedição. Ele lista todos os números de balanceamento (cerca de 130), em grupos e
com busca, e troca o valor na hora:

- todas as constantes de `src/data/balance.ts`, menos as técnicas (laço, gravação, versão);
- nível de cada mapa de expedição;
- multiplicadores de vida, Patacas e XP de cada visagem e a chance de cada queda;
- dano base e intervalo de cada encantado;
- visagens até o chefe, tempo do chefe e chance de Rastro de cada zona;
- custo, crescimento do custo e bônus de cada melhoria.

Atalhos: nível do primeiro da comitiva e +1000 Patacas. As mudanças ficam no navegador (chave
`encantados-ajustes`), aparecem no botão ("Ajustes (N)") e numa lista com o arquivo onde mudar de
vez. "Voltar" e "Desfazer tudo" voltam ao código.

Exceção à arquitetura, registrada no guia: `src/store/tuning.ts` troca os números direto nos
objetos de `src/data`. Constante nova em `balance.ts` sem campo no painel faz o `typecheck` falhar.

Arquivos:

- `src/store/tuning.ts` (novo): lista de campos, mudar, desfazer, guardar e carregar.
- `src/store/useGameStore.ts`: aplica os ajustes guardados ao abrir; ações `setTuning`,
  `resetTuning` e `debugSetLeaderLevel`.
- `src/store/types.ts`: campo de sessão `tuningVersion` e as ações novas.
- `src/store/selectors.ts`: bloco "Ajustes de teste" (`selectTuningView`, `selectTuningChangeCount`).
- `src/components/debug/TuningPanel.tsx` (novo): botão e janela.
- `src/components/header/AppHeader.tsx` e `src/components/expedition/ExpeditionScreen.tsx`: o
  botão no cabeçalho.
- `tests/tuning.test.ts` e `tests/TuningPanel.test.tsx` (novos).

## 26/11/2026: projéteis na expedição

O golpe especial em área não ficou bom. Os golpes da expedição viraram projéteis, simples e sem
arte (blocos pequenos, como o resto do mapa):

- **Comum:** sai sozinho quando a barra de ataque enche e há visagem a até 4 ladrilhos (antes
  1,6). Voa reto na direção em que a visagem estava e para na primeira que acerta.
- **Especial (espaço):** sai para o lado em que a personagem andou por último, com 4 vezes o
  dano, e atravessa todas as visagens no caminho. Recarga de 6 segundos, como antes.
- Os dois somem ao bater em árvore ou água, ou depois da distância máxima (5 e 9 ladrilhos).
- O acerto é conferido no trecho inteiro que o projétil andou em cada passo, para um projétil
  rápido não atravessar uma visagem sem tocar nela.
- Saíram o anel azul do golpe especial e o evento `special`.

Ritmo medido parado no lugar (pior caso): no nível 1 a personagem cai entre 1min30 e 2min30; no
nível 10 já aguenta os 5 minutos. Com o alcance maior, desviar ficou mais vantajoso.

Arquivos:

- `src/domain/types.ts`: `SceneProjectile`; a cena ganhou `projectiles`, `facingX`, `facingY` e
  `nextProjectileUid`.
- `src/domain/expeditionScene.ts`: disparos no bloco "Golpes" e o bloco novo "Projéteis" (voo,
  acerto, atravessar, fim).
- `src/data/balance.ts`: `attackRange: 4`, bloco "Expedições: projéteis"; saiu `specialRadius`.
- `src/store/selectors.ts`: projéteis no `SceneFrame`.
- `src/components/expedition/mapRenderer.ts`: camada dos projéteis; saiu o anel.
- `src/components/expedition/sprites.ts`: vagas `projectile.png` e `special-projectile.png`.
- `src/components/expedition/ExpeditionCanvas.tsx` e `ExpeditionSidePanel.tsx`: textos e
  legenda.
- `tests/expedition.test.ts`: bloco "golpes e projéteis".

## 26/11/2026: clareira e expedições (caminho C)

O protótipo do mundo aberto virou um passeio: andar e bater sozinho, sem perigo. A decisão foi
seguir o caminho C do documento "pivo-gameplay-ativa" do projeto: a **clareira** (o combate por
estágios de antes) é a base idle e rende sempre, e a **expedição** é a parte ativa, que sai da
clareira. A tela antiga voltou a ser a principal e `?classico` deixou de existir. O salvamento
subiu para a versão 5.

Regras da expedição:

- Sai o primeiro encantado da comitiva, com vida (100 no nível 1, +10% por nível).
- As visagens perseguem quem chega a 9 ladrilhos e batem ao encostar (uma vez por segundo
  cada). Andam mais devagar que a personagem.
- Ondas: começa com 6 visagens. O teto e o ritmo de chegada sobem a cada minuto, e as visagens
  novas nascem um nível acima a cada minuto.
- Golpe comum automático, como antes. Golpe especial na tecla espaço: acerta todas em volta
  (2,5 ladrilhos) com 4 vezes o dano, e recarrega em 6 segundos.
- A expedição termina no fim dos 5 minutos (bônus de 50% a mais de visagens na bolsa), quando a
  vida zera, pela passagem de volta ou pelo botão. A bolsa nunca se perde.
- A clareira continua rendendo durante a expedição. A expedição não roda com o jogo fechado:
  uma ausência ou recarga no meio dela entrega a bolsa como "interrompida".

Ritmo medido parado no lugar, sem desviar (o pior jeito de jogar): no nível 1 a personagem cai
entre 30 segundos e 2 minutos e meio; no nível 10 já aguenta os 5 minutos. Desviando, aguenta
mais. Não há ausência no mapa: a conta do protótipo anterior (`worldOffline.ts`) saiu.

Domínio:

- `src/domain/expeditionScene.ts` (antes `world.ts`, reescrito): cena com vida, perseguição,
  encostada, ondas, golpe especial, fim do tempo e passagem de volta.
- `src/domain/expedition.ts` (novo): quem sai (`getExpeditionFighter`), partir, bolsa e a volta
  com o bônus (`finishExpedition`, que usa `rewardKills`).
- `src/domain/worldOffline.ts`: apagado.
- `src/domain/formulas.ts`: `getEnemyContactDamage` e `getExpeditionMaxHp`.
- `src/domain/types.ts`: bloco "Expedições". `GameState.world` saiu e entrou
  `GameState.expedition` (mapa, quem saiu e a bolsa).
- `src/domain/catalog.ts`: `getExpeditionMap` e `hasExpeditionMap` no lugar das consultas de mapa
  do mundo aberto. `src/domain/state.ts`: jogo novo sem expedição.

Dados:

- `src/data/world.ts`: `EXPEDITION_MAPS`, com a passagem de volta (`exit`) no lugar das
  passagens entre mapas.
- `src/data/balance.ts`: `saveVersion: 5` e os blocos "Expedições" (personagem, visagens, ondas).

Store:

- `src/store/useGameStore.ts`: a clareira roda em todo tick e a expedição anda por cima
  (`runExpeditionTick`, `endExpedition`). Ações `startExpedition`, `leaveExpedition`,
  `setMoveInput`, `triggerSpecial` e `dismissExpeditionReport`. Saíram `setEngine` e
  `setWorldInput`.
- `src/store/types.ts`: campos de sessão `expeditionScene`, `moveInput`, `isSpecialPending`,
  `sceneEvents` e `expeditionReport`. Saiu o campo `engine`.
- `src/store/gameLoop.ts`: o intervalo cai para 16 ms durante a expedição e volta a 100 ms.
- `src/store/saveManager.ts`: `MIGRATIONS[4]` (versão 4 para 5) e `sanitizeExpedition`.
- `src/store/selectors.ts`: bloco "Expedições" (aba, painel, janela da volta e `readSceneFrame`).

Tela:

- `src/components/expedition/` (antes `world/`): `ExpeditionsPanel` (aba da clareira),
  `ExpeditionScreen`, `ExpeditionCanvas`, `mapRenderer.ts` (com vida, tempo, bolsa e golpe
  especial desenhados por cima do mapa), `ExpeditionSidePanel` e `sprites.ts`.
- `src/components/modals/ExpeditionReportModal.tsx` (novo): janela da volta.
- `src/components/hooks/useExpeditionKeyboard.ts` (antes `useWorldKeyboard.ts`): espaço para o
  golpe especial.
- `src/components/GameScreen.tsx`: aba "Expedições" na lateral esquerda e a janela da volta.
- `src/App.tsx`: clareira ou expedição conforme o estado. `?debug` continua.

Testes:

- `tests/expedition.test.ts` (antes `world.test.ts`): cena, perseguição, encostada, queda,
  golpes, ondas, fim do tempo, partir, bolsa e bônus.
- `tests/ExpeditionScreen.test.tsx` (antes `WorldScreen.test.tsx`): aba, troca de tela, teclado,
  voltar e janela da volta.
- `tests/data.test.ts`, `tests/store.test.ts` e `tests/GameScreen.test.tsx` ajustados.

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
