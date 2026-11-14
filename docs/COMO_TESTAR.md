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
dados, as fórmulas, o combate, os pactos, o progresso offline, o salvamento e o painel de debug.

Dois comandos extras, que também devem terminar sem erro:

```bash
npm run typecheck
npm run lint
```

## 4. Abrir o jogo

```bash
npm run dev
```

Abra o endereço que aparecer no terminal, normalmente `http://localhost:5173`. Para parar,
volte ao terminal e aperte `Ctrl + C`.

## 5. Roteiro de teste manual

Faça na ordem. Cada linha diz o que fazer e o que deve acontecer.

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

## 6. Se algo der errado

| Problema | O que fazer |
|---|---|
| `npm install` falha com erro de versão | Confira o `node -v`. Atualize o Node.js para a versão LTS. |
| A página abre em branco | Abra as ferramentas do navegador (F12), aba Console, e veja o erro em vermelho. |
| O jogo abriu com números estranhos de um teste antigo | Use "Apagar tudo" (três cliques). |
| "Parado: jogo aberto em outra aba" | Feche as outras abas do jogo e recarregue esta. |
| A porta 5173 está ocupada | O Vite escolhe outra porta e mostra o endereço novo no terminal. |

Para ver o salvamento cru: F12, aba Application (ou Armazenamento), Local Storage, chave
`encantados-save`.
