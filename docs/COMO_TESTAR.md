# Como testar

Passo a passo para rodar o jogo no seu computador e conferir o motor pelo painel de debug.

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
dados, as fórmulas, o combate, as ações, os pactos, o progresso offline, o salvamento, a tela
do jogo, o painel de debug e as regras de arquitetura (pastas, importações, pureza do domínio e proibição de
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

O terminal mostra um endereço, normalmente `http://localhost:5173`. São duas telas:

- `http://localhost:5173/` abre o jogo.
- `http://localhost:5173/?debug` abre o painel de debug, com os números crus e os botões de teste.

Para parar, volte ao terminal e aperte `Ctrl + C`.

## 5. Roteiro do jogo

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
| 13 | Jogar até juntar 3 Rastros e 5 de mel silvestre (alguns minutos) | Aparece um número vermelho na aba "Almanaque" e o botão "Fechar pacto" da Caipora acende. |
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

## 6. Roteiro do painel de debug

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

Com o jogo rodando por alguns minutos, "Rastros: Caipora" sobe até 3 de 3 e "Mel silvestre"
aumenta. "Rastros: Boitatá" só sobe quando o "Relógio do sertão" marca noite. O painel ainda
não tem botão para fechar pacto.

## 7. Se algo der errado

| Problema | O que fazer |
|---|---|
| `npm install` falha com erro de versão | Confira o `node -v`. Atualize o Node.js para a versão LTS. |
| A página abre em branco | Abra as ferramentas do navegador (F12), aba Console, e veja o erro em vermelho. |
| O jogo abriu com números estranhos de um teste antigo | Use "Apagar tudo" (três cliques). |
| Aviso de jogo aberto em outra aba | Feche as outras abas do jogo e recarregue esta. O jogo e o painel de debug abertos ao mesmo tempo também contam como duas abas. |
| A porta 5173 está ocupada | O Vite escolhe outra porta e mostra o endereço novo no terminal. |

Para ver o salvamento cru: F12, aba Application (ou Armazenamento), Local Storage, chave
`encantados-save`.
