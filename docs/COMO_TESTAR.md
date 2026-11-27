# Como testar

Passo a passo para rodar o jogo no seu computador, conferir a clareira, as expedições e o motor
pelo painel de debug.

## 1. Preparar o computador (só na primeira vez)

1. Instale o [Node.js](https://nodejs.org) na versão LTS. O projeto pede a versão 20.19 ou
   mais nova (ou 22.12 ou mais nova).
2. Instale o [Git](https://git-scm.com), se ainda não tiver.
3. Abra o terminal (no Windows, o PowerShell) e confira:

```bash
node -v
git --version
```

## 2. Baixar e instalar

```bash
git clone https://github.com/Laps-F/idle.git
cd idle
npm install
```

Se você já tem a pasta, entre nela e atualize:

```bash
git pull
npm install
```

## 3. Rodar os testes automáticos

```bash
npm test
```

O esperado é terminar com todos os arquivos e testes como `passed`. Esses testes conferem os
dados (incluindo os mapas), as fórmulas, o combate, as expedições (movimento, perseguição,
golpes, ondas, fim do tempo, bolsa e bônus), as ações, os pactos, os amuletos, a Rebrota e o
juazeiro, o progresso offline, o
salvamento (incluindo a abertura de salvamentos da versão anterior), a tela do jogo, o painel
de debug e as regras de arquitetura (pastas, importações, pureza do domínio e proibição de
`any`).

Dois comandos extras, que também devem terminar sem erro:

```bash
npm run typecheck
npm run lint
```

## 4. Abrir o jogo

```bash
npm run dev
```

O terminal mostra um endereço, normalmente `http://localhost:5173`. São duas telas, com o mesmo
salvamento:

- `http://localhost:5173/` abre o jogo: a clareira e, dela, as expedições.
- `http://localhost:5173/?debug` abre o painel de debug, com os números crus e os botões de teste.

Para jogar sem instalar nada, use o site: https://laps-f.github.io/idle/ (e
https://laps-f.github.io/idle/?debug). Ele é atualizado sozinho alguns minutos depois de cada
envio para o `main`. O salvamento do site é separado do salvamento do `localhost`.

Para ver a versão final, igual à do site, rode `npm run build` e depois `npm run preview` e
abra `http://localhost:4173/idle/`.

Para parar, volte ao terminal e aperte `Ctrl + C`.

## 5. Roteiro da expedição (protótipo)

Abra `http://localhost:5173/`, escolha um encantado e faça na ordem. Para começar do zero, use
"Apagar tudo".

Nesta fase nada tem imagem no mapa: cada coisa é um bloco colorido com o nome do arquivo que vai
entrar no lugar (lista em [SPRITES.md](SPRITES.md)).

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 1 | Olhar a lateral esquerda | A primeira aba é "Expedições". Ela diz quem entra em campo primeiro (o primeiro da comitiva) e com quanta vida, quem reveza com ele e com que tecla, e lista "Beira da Mata" e "Brejo Escuro". |
| 2 | Clicar em "Partir para Beira da Mata" | A clareira dá lugar ao mapa. Em cima do mapa aparecem a vida, o golpe especial, o tempo que falta (5 minutos) e a bolsa. A personagem é o bloco amarelo, dentro de um círculo claro (o alcance do golpe). |
| 3 | Apertar as setas ou W, A, S e D | A personagem anda nas quatro direções e na diagonal. Para ao encostar em árvore ou água. A página não rola. |
| 4 | Chegar perto das visagens (blocos vermelhos) | Elas vêm atrás de você, mais devagar do que você anda. Encostando, batem: sobe um número vermelho, a personagem pisca e a vida cai. |
| 5 | Deixar uma visagem dentro do círculo | Quando a barra amarela embaixo da personagem enche, sai um quadradinho claro (o projétil) na direção da visagem. Ao acertar, sobe o número do dano. A visagem derrotada some e a bolsa soma 1. |
| 6 | Com o Saci, chegar perto de visagens e apertar espaço | Redemoinho: um anel azul abre em volta, as visagens perto são empurradas para longe (sobe o dano), e a personagem fica meio apagada por 1 segundo, sem levar golpe nesse tempo. A barra do golpe especial esvazia e enche de novo em 6 segundos. |
| 6a | Na aba "Expedições", olhar a linha "Golpe especial (espaço)" | Mostra o golpe de quem sai, o que ele faz e a recarga. Passando o mouse em cada botão de "Trocar quem entra primeiro" aparece o golpe daquele encantado. Durante a expedição, o painel ao lado do mapa mostra o golpe também. |
| 6b | Sair com o Curupira, deixar visagens se aproximarem e apertar espaço | Pés virados: as visagens perto ganham um "?" e passam 3 segundos passeando, sem perseguir nem bater. Recarga de 8 segundos. |
| 6c | Sair com a Iara, levar uns golpes e apertar espaço | Canto da Iara: sobe um número verde e a vida volta 25% da máxima, sem passar dela. Recarga de 10 segundos. |
| 6d | Sair com a Caipora, apertar espaço com visagens perto | Assobio: as visagens perto ficam azuladas e andam bem mais devagar por 4 segundos. Se alguém ainda precisa de Rastro, surge uma pegada no mapa. Recarga de 8 segundos. |
| 6e | Sair com o Boitatá, andar para um lado e apertar espaço | Rastro de fogo: sai o projétil azul para o lado em que você andou, atravessa as visagens, e as acertadas ficam alaranjadas embaixo e perdem vida por 3 segundos. Recarga de 6 segundos. |
| 7 | Olhar o cabeçalho durante a expedição | As Patacas não sobem: a clareira fica parada enquanto a comitiva está fora. |
| 8 | Ficar 1 ou 2 minutos | Chegam mais visagens, mais rápido, e o número ao lado do nome delas (o nível) sobe a cada minuto. Cada encostada tira uma parte maior da vida. |
| 8a | Voltar, comprar melhorias ou subir o nível do encantado e olhar a aba "Expedições" de novo | O nível ao lado de cada mapa sobe junto com a força média de quem sai (a comitiva inteira). O Brejo Escuro fica sempre 1 nível acima da Beira da Mata. Na expedição, uma visagem comum continua aguentando uns 3 golpes. |
| 9 | Voltar pelo bloco roxo "← Clareira" (ou pelo botão "Voltar para a clareira agora") | A clareira volta e abre a janela "De volta à clareira", com as visagens da bolsa, as Patacas, o XP e o que caiu. Com umas 15 visagens, as Patacas ficam perto do que a clareira rende em 5 minutos. |
| 9b | Na aba "Expedições", ler a linha "Pegadas" de cada mapa | De dia aparece "Caipora (faltam 3)". À noite aparece também o Boitatá. Depois de fechar os dois pactos, "nenhum encantado precisa de Rastro agora". |
| 9c | Partir e esperar uns 10 segundos | Surge um bloco laranja pequeno escrito "Pegada: Caipora", longe da personagem. A cada uns 20 segundos surge outra, no máximo 2 no chão. Às vezes uma visagem derrotada deixa uma pegada onde caiu. |
| 9d | Passar por cima da pegada | Sobe "+1 Rastro", a pegada some e "Rastros" no painel de cima e em "Rastros na bolsa" sobe 1. Na volta, a janela mostra os Rastros e o Almanaque soma, sem passar do que o pacto pede. |
| 9j | Com dois ou mais na comitiva, clicar num nome em "Trocar quem entra primeiro" na aba "Expedições" | "Entra em campo primeiro" muda para ele, e é ele que aparece no mapa ao partir. Com um só na comitiva, os botões não aparecem. |
| 9k | Com três na comitiva, partir e olhar embaixo do mapa | Uma faixa mostra os três, cada um com a tecla, a vida e a barra azul do golpe. Quem está em campo tem um contorno amarelo. No fim da faixa, a barra da troca. O painel ao lado diz "Em campo: ..." e a tecla de cada um. |
| 9l | Apertar 2 (ou 2 do teclado numérico) | Quem estava na posição 2 entra em campo: a figura muda, a vida em cima do mapa passa a ser a dele, o golpe especial é o dele e um anel azul pequeno abre em volta. A barra da troca esvazia e enche em 3 segundos. Apertar 1 logo depois não faz nada. |
| 9m | Usar o golpe especial, trocar e esperar | A barra azul do golpe de quem saiu de campo continua enchendo na faixa de baixo. Voltando para ele, o golpe já pode estar pronto. |
| 9n | Deixar quem está em campo cair | Sobe "Caiu!" em vermelho, ele aparece apagado com "(caiu)" na faixa, e o próximo entra sozinho, meio apagado por 1 segundo (sem levar golpe). A tecla de quem caiu não faz mais nada. |
| 9o | Deixar todos caírem | Só quando o último cai abre "A comitiva te trouxe de volta", com "Todos caíram depois de...". |
| 9p | Voltar pela passagem depois que alguém caiu | A janela da volta mostra a linha "Caíram no caminho" com o nome. |
| 9e | Na aba "Expedições", olhar "Preparo (opcional)" sem Oferendas | Os três preparos aparecem apagados, com o custo e quanto você tem ("Custa 3 Mel silvestre (você tem 0)"). |
| 9f | Juntar 3 de mel silvestre, clicar em "Favo no toco" e partir | O botão de partir passa a dizer "Partir para ... com Favo no toco". Ao partir, o mel cai 3, chegam mais visagens e mais depressa, e o painel ao lado do mapa mostra "Preparo: Favo no toco". A janela da volta também mostra o preparo. |
| 9g | Partir com "Trilha de cipó" (3 de cipó) | As pegadas surgem duas vezes mais rápido (a primeira uns 5 segundos depois de partir). |
| 9h | Partir com "Brasa no bornal" (1 brasa viva, do Corpo-Seco ou do Brejo Escuro) | O golpe especial tira o dobro (no empurrão do Saci e na labareda do Boitatá) e a barra dele enche um terço mais rápido (com o Saci, em 4 segundos em vez de 6). |
| 9i | Escolher um preparo e clicar nele de novo | A escolha é desfeita e partir não gasta nada. |
| 9a | Fazer algumas expedições no Brejo Escuro | De vez em quando a bolsa traz brasa viva, que antes só o Corpo-Seco da clareira deixava. Os amuletos caem com mais frequência que na Beira da Mata. |
| 10 | Partir de novo e deixar a vida de todos zerar | Abre "A comitiva te trouxe de volta". A bolsa vem inteira, sem bônus. |
| 11 | Aguentar os 5 minutos | Abre "Expedição completa", com a linha "Visagens de bônus" (metade a mais). |
| 12 | Recarregar a página no meio de uma expedição | A clareira abre com "Expedição interrompida" e a bolsa entregue. |
| 12a | Partir, trocar para outra aba por uns segundos e voltar | O mapa está coberto pelo aviso "Pausado". O tempo, a vida, as visagens e as Patacas não mudaram enquanto você estava fora (a clareira também fica parada). |
| 12b | Com o aviso na tela, apertar espaço | O aviso some e o jogo continua, sem soltar o golpe especial. Shift, Ctrl, Alt ou Tab sozinhos não continuam. |
| 12c | Clicar em outra janela do computador e voltar | Pausou do mesmo jeito. Um clique no mapa continua. |
| 12d | Apertar P | Pausa na hora. Qualquer tecla continua. |
| 12e | Pausar, deixar a aba escondida por mais de 2 minutos e voltar | A expedição continua lá, pausada, com a bolsa. A ausência não rende nada na clareira, e não aparece janela de boas-vindas. |
| 12f | Partir, ficar uns 30 segundos sem fazer nada e voltar | Durante a expedição, as Patacas do cabeçalho não sobem. Na janela da volta aparece "Na clareira, esse tempo renderia N Patacas" e a linha "Garantia da clareira", completando até esse valor. |
| 12g | Fazer uma expedição boa (muitas visagens) e voltar | A janela diz "A expedição rendeu X vezes isso", sem linha de garantia. |
| 12h | Recarregar a página no meio de uma expedição | Além de "Expedição interrompida", a garantia vale pelo tempo que a expedição andou, e a ausência depois da recarga rende na clareira, como sempre. |

### Ajustes de teste

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 13 | Clicar em "Ajustes", no cabeçalho | Abre "Ajustes de teste", com os atalhos em cima, a busca e os grupos de números. |
| 14 | Buscar "vida", mudar "Vida base no nível 1" para 300 e apertar Enter | O nome fica em negrito, aparece "código: 100" e o botão "Voltar". O botão do cabeçalho vira "Ajustes (1)" e a aba "Expedições" passa a dizer "com 300 de vida". Embaixo aparece "src/data/balance.ts, playerBaseHp: 100 -> 300". |
| 15 | Mudar "Nível do primeiro da comitiva" para 10 | O encantado passa ao nível 10 na hora (veja na aba "Comitiva"). |
| 16 | Recarregar a página | O botão continua "Ajustes (1)": a mudança ficou guardada no navegador. |
| 17 | Abrir "Ajustes" durante uma expedição e mudar "Encostada no nível de partida" das visagens | As visagens que nascem dali em diante batem com o dano novo. As setas e o W, A, S e D não movem a personagem enquanto você escreve no campo. |
| 18 | Clicar em "Desfazer tudo" | Todos os números voltam ao código e o botão volta a "Ajustes". |
| 19 | Clicar em "Fechar" (ou apertar Esc) | A janela fecha. |

## 6. Roteiro da clareira (combate por estágios)

Abra `http://localhost:5173/`. Faça na ordem. Cada linha diz o que fazer e o que deve acontecer.

Para começar do zero, use "Apagar tudo" no cabeçalho.

### Começo e arena

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 1 | Abrir a página com o jogo zerado | Abre a janela "Quem começa com você?", com Saci, Curupira e Iara. Não dá para fechar sem escolher. |
| 2 | Clicar em "Começar com Saci" | A janela fecha. No centro aparece a capa verde com uma visagem. O cabeçalho mostra "Mata Atlântica, estágio 1". |
| 3 | Olhar a barra do Saci, embaixo da capa | Ela enche de forma contínua, sem pulos, e recomeça a cada golpe. |
| 4 | Olhar a capa por uns 10 segundos | A cada golpe o inimigo dá um tranco, um número sobe e a barra de vida cai. Quando ele cai, sobe "+N Patacas", entra outro inimigo e aparece uma linha em "O que aconteceu". |
| 5 | Olhar o cabeçalho | As Patacas sobem a cada derrota. As Oferendas (mel, cipó, brasa) sobem de vez em quando. |
| 6 | Esperar a décima visagem (cerca de 40 segundos) | Os dez quadradinhos da capa ficam cheios e entra o "Corpo-Seco", com "Chefe do estágio" e a contagem "Faltam N s para o chefe escapar". Vencendo, a capa e o cabeçalho passam para o estágio 2. |

### Melhorias e estágios

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 7 | Olhar a aba "Melhorias" sem Patacas suficientes | Os botões de compra ficam apagados. |
| 8 | Juntar 10 Patacas | Aparece um número vermelho na aba "Melhorias" e o botão "Comprar por 10 Patacas" acende. |
| 9 | Clicar em "Comprar por 10 Patacas" | A Reza forte vai para o nível 1, o botão passa a mostrar 12 Patacas e as Patacas do cabeçalho caem 10. |
| 10 | Abrir a aba "Estágios" e clicar em "Anterior" | O jogo volta um estágio. "Mais alto" leva de volta ao último liberado. |
| 11 | Desmarcar "Avanço automático" e esperar 10 visagens | O chefe não aparece sozinho e o botão "Desafiar o chefe" acende. Clicando, o chefe entra. Depois, marque de novo. |

### Comitiva e Almanaque

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 12 | Abrir a aba "Almanaque" | Aparecem Caipora e Boitatá, cada um com a quadra de cordel e a lista do que o pacto pede. O Boitatá mostra "Só fecha de noite". |
| 13 | Juntar 3 Rastros e 5 de mel silvestre. O jeito rápido é uma expedição (pegadas no chão). Só na clareira leva uns 15 minutos. | Aparece um número vermelho na aba "Almanaque" e o botão "Fechar pacto" da Caipora acende. |
| 14 | Clicar em "Fechar pacto" | A Caipora entra na comitiva: surge uma segunda barra de ataque embaixo da capa e um segundo cartão na aba "Comitiva". |
| 15 | Na aba "Comitiva", clicar em "Tirar da comitiva" em um dos dois | Ele sai e a barra dele some. O botão do outro fica apagado, porque a comitiva não pode ficar vazia. "Chamar para a comitiva" traz de volta. |

### Salvamento

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 16 | Recarregar a página (F5) | O jogo volta igual: Patacas, estágio, comitiva e melhorias. |
| 17 | Clicar em "Exportar" e depois em "Copiar código" | Abre uma janela com um código comprido e aparece "Código copiado." |
| 18 | Clicar em "Importar", escrever `abc` e clicar em "Importar" | Aparece uma mensagem de erro em vermelho e o jogo não muda. |
| 19 | Na mesma janela, colar o código copiado e clicar em "Importar" | A janela fecha e o jogo fica como estava na hora da exportação. |
| 20 | Clicar em "Apagar tudo" e depois em "Cancelar" | Nada é apagado. |
| 21 | Clicar em "Apagar tudo", "Quero apagar" e "Apagar tudo agora" | Só no terceiro clique o jogo zera e volta para a escolha do encantado inicial. |

### Ausência, relógio e abas

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 22 | Com a comitiva lutando, fechar a aba, esperar 3 minutos e abrir de novo | Abre sozinha a janela "Que bom que você voltou", com o tempo fora, o tempo que rendeu (metade) e os ganhos. "Continuar" fecha. |
| 23 | Trocar de aba do navegador por 1 minuto e voltar | Não abre janela nenhuma, e as Patacas subiram como se a aba estivesse aberta. |
| 24 | Acompanhar o relógio no cabeçalho | A cada 12 minutos ele troca entre "Dia" e "Noite". À noite a capa escurece. |
| 25 | Abrir o mesmo endereço em uma segunda aba | A primeira aba mostra "O jogo está aberto em outra aba", com o botão de recarregar. A segunda roda normalmente. |
| 26 | Estreitar a janela do navegador (ou abrir no celular) | Os painéis empilham: arena em cima, depois comitiva e progresso. Nada sai para o lado. |

Para testar a ausência sem esperar, use o painel de debug: o botão "Simular 1 hora fora" faz o
mesmo cálculo e mostra o relatório lá.

### Amuletos

Amuleto cai de chefe em 6 de cada 10 vitórias, e de visagem comum bem de vez em quando. Para
não depender da sorte, os passos 28 a 34 usam o botão "Ganhar um amuleto" do painel de debug
(`/?debug`), que entrega um amuleto sorteado do mesmo jeito que o combate.

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 27 | Abrir a aba "Amuletos", na lateral direita, antes de achar qualquer amuleto | Aparece "0 Cavacos. Mochila com 0 de 20 amuletos." e o aviso de mochila vazia. |
| 28 | No painel de debug, clicar 6 vezes em "Ganhar um amuleto" e voltar para o jogo | A aba "Amuletos" mostra um número vermelho. A mochila lista 6 amuletos, do mais raro para o mais comum, cada um com figura, carimbo de raridade e bônus. O cabeçalho passa a mostrar os Cavacos, com o ícone de martelo. |
| 29 | Clicar em "Vestir em Saci" em um amuleto de dano (Figa de guiné) | O amuleto sobe para "Quem veste", o número da aba some e o "dano a cada" do cartão do Saci, na aba "Comitiva", aumenta. |
| 30 | Clicar em "Vestir em Saci" em outro amuleto | O novo entra no lugar e o antigo volta para a mochila. |
| 31 | Clicar em "Desmanchar: +N Cavacos" em um amuleto da mochila | Ele some e os Cavacos sobem N, na aba e no cabeçalho. |
| 32 | Com Cavacos suficientes, clicar em "Entalhar por N Cavacos" | Os Cavacos caem N, o entalhe sobe 1, os bônus aumentam 10% do valor original e o próximo entalhe fica mais caro. Sem Cavacos, o botão fica apagado. |
| 33 | Clicar em "Guardar na mochila" no amuleto vestido | Ele volta para a mochila e o dano do Saci cai para o que era. |
| 34 | Escolher "Só os comuns" em "Desmanchar sozinho o que cair" e ganhar mais amuletos pelo painel de debug | Os comuns não entram na mochila: viram Cavacos na hora. Os outros entram. Depois, volte para "Nunca". |
| 35 | Jogar até vencer alguns chefes | De vez em quando o registro mostra "Amuleto encontrado: (nome) (raridade)" e a mochila ganha o amuleto. |
| 36 | Recarregar a página (F5) | Amuletos, quem veste, Cavacos e a escolha do desmanche automático continuam iguais. |
| 37 | Fechar a aba por alguns minutos (ou usar "Simular 1 hora fora" no painel de debug) | O relatório de volta mostra "Amuletos encontrados" e, se a mochila encheu, "Cavacos de N amuletos desmanchados". |

Para conferir que um jogo salvo antes dos amuletos continua abrindo, não é preciso fazer nada
à mão: o teste "abre um salvamento da versão 1 sem perder nada e já na versão atual", de
`tests/store.test.ts`, faz isso a cada `npm test`.

### Rebrota e juazeiro

Chegar ao estágio 35 leva uns 25 minutos. Para não esperar, os passos 39 a 41 usam o painel de
debug para adiantar o jogo.

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 38 | Começar um jogo novo e olhar a lateral esquerda | Só existem as abas "Expedições", "Comitiva" e "Almanaque". |
| 39 | No painel de debug, clicar em "+10,00K Patacas" algumas vezes, comprar melhorias e usar "Simular 1 hora fora" até "Estágio máximo" passar de 35 | De volta ao jogo, aparece a aba "Juazeiro", com um número vermelho. |
| 40 | Abrir a aba "Juazeiro" | Aparecem o desenho da árvore, "Edição 1 do folheto", o quadro "Rebrota" com "Rebrotar agora rende N Raízes", o estágio da próxima Raiz e as Raízes por hora, e os três galhos com os nós apagados. |
| 41 | Clicar em "Rebrotar" e depois em "Agora não" | A janela mostra o que fica e o que volta ao começo. "Agora não" fecha sem mudar nada. |
| 42 | Clicar em "Rebrotar" e, na janela, em "Rebrotar" | A página vira e é carimbada "Edição 2", com as Raízes ganhas. O registro mostra "Edição 2 começou". "Começar a edição 2" fecha a janela. |
| 43 | Olhar o resto da tela | O cabeçalho mostra "Edição 2" e as Raízes. O estágio volta a 1, Patacas e melhorias zeram e o Saci volta ao nível 1. Amuletos, Cavacos, Rastros e encantados conquistados continuam. |
| 44 | Na aba "Juazeiro", clicar em "Fincar: 1 Raiz" no "Cerne duro" | O nó passa a "Nível 1 de 10", as Raízes livres caem 1, as fincadas continuam iguais e o galho da Força escurece no desenho. O dano do Saci na aba "Comitiva" sobe. |
| 45 | Olhar o quadro "Rebrota" | O botão fica apagado e diz em que estágio a próxima Rebrota libera: só conta o que passar do recorde. |
| 46 | No painel de debug, clicar em "+10 Raízes" e, no juazeiro, fincar a "Mão ligeira" | Aparece a chave "Comprar melhorias sozinho", já marcada. As melhorias passam a ser compradas sozinhas. Desmarcar para a compra. |
| 47 | Recarregar a página (F5) | Edição, Raízes, nós do juazeiro e a chave da compra automática continuam iguais. |

Um jogo salvo antes da Rebrota (versão 2) abre na edição 1, com tudo o que já tinha. O teste
"abre um salvamento da versão 2 sem perder nada", de `tests/store.test.ts`, confere isso.

## 7. Roteiro do painel de debug

Abra `http://localhost:5173/?debug`. O painel usa o mesmo jogo salvo da tela principal. Faça na
ordem. Cada linha diz o que fazer e o que deve acontecer.

### Laço e combate

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 1 | Abrir a página | Aparece o painel de debug. Em "Laço do jogo", a situação passa de "Medindo..." para "Rodando" e "Ticks no último segundo" fica perto de 10. |
| 2 | Olhar "Ticks desde que a página abriu" por alguns segundos | O número sobe sem parar. |
| 3 | Em "Comitiva", clicar em Saci | Aparece "Saci, nível 1". A vida do inimigo começa a cair e a barra vermelha diminui. |
| 4 | Esperar uns 10 segundos | "Visagens derrotadas" e "Patacas" sobem. O XP do Saci sobe. |
| 5 | Clicar em "Golpe manual (25% da vida)" | A vida do inimigo cai um quarto na hora. |
| 6 | Clicar em "Derrotar inimigo" | "Visagens derrotadas" sobe 1 e entra outro inimigo com a vida cheia. |

### Recursos e melhorias

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 7 | Clicar em "+100 Patacas" | "Patacas" sobe 100. "Patacas ganhas no total" não muda. |
| 8 | Clicar em "Reza forte, nível 0: 10 Patacas" | O botão passa a mostrar "nível 1: 12 Patacas" e as Patacas caem 10. |
| 9 | Ficar sem Patacas para uma melhoria | O botão dela fica apagado e não aceita clique. |

Na seção "Recursos" também aparecem "Cavacos", "Amuletos na mochila", "Amuletos vestidos",
"Amuletos encontrados no total", "Edição do folheto", "Raízes livres", "Recorde de edições
passadas" e "Rebrotar agora rende". Em "Controles de teste", "+10 Raízes" finca Raízes sem
rebrotar e "Rebrotar" rebrota na hora (fica apagado até a Rebrota liberar). O botão "Ganhar um amuleto", em "Controles de teste", entrega
um amuleto sorteado para o estágio atual: "Amuletos encontrados no total" sobe 1 e o amuleto
vai para a mochila (ou vira Cavacos, se a mochila estiver cheia ou o desmanche automático
pegar a raridade dele).

### Chefe e estágios

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 10 | Clicar em "Derrotar inimigo" até "Visagens no estágio" chegar a 10 | O inimigo vira "Corpo-Seco (chefe)" e "Tempo do chefe" começa a contar a partir de 30 segundos. |
| 11 | Clicar em "Derrotar inimigo" com o chefe em campo | "Estágio" passa para 2 e "Chefes vencidos" sobe 1. |
| 12 | Clicar em "Desligar avanço automático" e derrotar 10 visagens | O chefe não aparece sozinho. "Visagens no estágio" para em 10 de 10. |
| 13 | Clicar em "Desafiar chefe" | O chefe entra em campo. Depois, clique em "Ligar avanço automático". |

### Salvamento

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 14 | Clicar em "Gravar agora" | Aparece "Gravado às (horário). O salvamento tem (número) caracteres no localStorage." |
| 15 | Recarregar a página (F5) | Patacas, estágio e nível do Saci continuam iguais. O contador de ticks recomeça do zero. |
| 16 | Anotar as Patacas e clicar em "Exportar" | A caixa de texto recebe um código comprido e aparece a mensagem de código exportado. |
| 17 | Clicar em "+10,00K Patacas" e depois em "Importar" | As Patacas voltam ao valor anotado e aparece "Jogo importado." |
| 18 | Apagar a caixa de texto, escrever `abc` e clicar em "Importar" | Aparece uma mensagem de erro e o jogo não muda. |

### Ausência

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 19 | Em "Ausência", clicar em "Simular 1 hora fora" | Aparece o relatório: "Tempo fora" perto de 1h e "Tempo que rendeu" de 30min, com Patacas e visagens ganhas. |
| 20 | Clicar em "Fechar relatório" e depois em "Simular 12 horas fora" | "Tempo que rendeu" mostra 4h 00min 00s, que é o teto de 8 horas com 50% de eficiência. |
| 21 | Fechar o relatório, trocar de aba do navegador por 1 minuto e voltar | Não aparece relatório. "Tempo de jogo" andou o minuto inteiro. |
| 22 | Opcional: fechar a aba do jogo, esperar 3 minutos e abrir de novo | O relatório aparece sozinho, com cerca de 3 minutos fora. |

Se você simular outra ausência com um relatório ainda aberto, os dois são somados. Por isso o
roteiro pede para fechar antes.

### Duas abas e apagar tudo

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 23 | Abrir o mesmo endereço em uma segunda aba | Na primeira aba, a situação vira "Parado: jogo aberto em outra aba" e os números param. A segunda aba roda normalmente. |
| 24 | Na aba que está rodando, clicar uma vez em "Apagar tudo" e esperar 4 segundos | O botão muda para "Tem certeza? Clique de novo" e depois volta sozinho para "Apagar tudo". Nada é apagado. |
| 25 | Clicar três vezes seguidas no mesmo botão | O jogo volta para a escolha do encantado inicial e as Patacas zeram. |

### Pactos (só leitura no painel)

Com o jogo rodando, "Rastros: Caipora" sobe até 3 de 3 (devagar na clareira, que dá poucos
Rastros; nas expedições, pelas pegadas, bem mais rápido) e "Mel silvestre" aumenta. "Rastros:
Boitatá" só sobe quando o "Relógio do sertão" marca noite. O painel ainda
não tem botão para fechar pacto.

## 8. Se algo der errado

| Problema | O que fazer |
|---|---|
| `npm install` falha com erro de versão | Confira o `node -v`. Atualize o Node.js para a versão LTS. |
| A página abre em branco | Abra as ferramentas do navegador (F12), aba Console, e veja o erro em vermelho. |
| O jogo abriu com números estranhos de um teste antigo | Use "Apagar tudo" (três cliques). |
| A personagem não anda no mapa | Clique uma vez na página, fora de caixas de texto, para ela receber as teclas. |
| O jogo está fácil ou difícil demais de um jeito estranho | Veja se o botão do cabeçalho mostra "Ajustes (N)". Se mostrar, há números de teste ligados: use "Desfazer tudo". |
| O espaço não solta o golpe especial | Confira a barra azul em cima do mapa: o golpe só sai quando ela está cheia. Cada encantado tem a própria recarga (de 6 a 10 segundos). |
| A personagem continua andando sozinha | Aperte e solte a tecla da direção. Trocar de janela também solta todas as teclas. |
| Aviso de jogo aberto em outra aba | Feche as outras abas do jogo e recarregue esta. O jogo e o painel de debug abertos ao mesmo tempo também contam como duas abas. |
| A porta 5173 está ocupada | O Vite escolhe outra porta e mostra o endereço novo no terminal. |
| O site do Pages abre em branco | Confira se `PAGES_BASE`, em `vite.config.ts`, tem o nome do repositório entre barras. |
| O site não mudou depois de um envio | Na aba Actions do GitHub, veja se "Publicar no GitHub Pages" terminou sem erro. Teste que falha impede a publicação. Depois, recarregue a página. |

Para ver o salvamento cru: F12, aba Application (ou Armazenamento), Local Storage, chave
`encantados-save`.
