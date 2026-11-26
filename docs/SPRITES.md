# Imagens do mapa (sprites)

O mapa da expedição ainda não tem imagens. Cada coisa do mapa aparece como um bloco
colorido com o nome do arquivo escrito por cima. Esta lista diz quais arquivos faltam e onde
eles entram.

## Onde colocar

1. Salve os arquivos em `public/sprites/`, com os nomes exatos da lista.
2. Em `src/components/expedition/sprites.ts`, troque `LOAD_SPRITE_IMAGES` para `true`.
3. Para tirar os nomes escritos por cima dos blocos, troque `SHOW_SPRITE_LABELS` para `false`.

Imagem que faltar continua aparecendo como bloco colorido, então dá para entregar aos poucos.

## Tamanho

- Ladrilhos: quadrados, desenhados em 48 por 48 pixels na tela (`TILE_PX`, em
  `src/components/expedition/mapRenderer.ts`). Vale desenhar em 48, 96 ou outro múltiplo.
- Personagem e visagens: quadrados, desenhados em 80% de um ladrilho (`FIGURE_SIZE`).
- Projéteis: quadrados pequenos, com 30% de um ladrilho (o dobro de `projectileRadius`).
- Fundo transparente (PNG) para personagem, visagens, projéteis e passagem.

## Lista

| Arquivo | O que é | Cor do bloco hoje |
|---|---|---|
| `grass.png` | Ladrilho de grama (chão) | verde-claro |
| `path.png` | Ladrilho de trilha (chão) | bege |
| `tree.png` | Árvore (não dá para passar) | verde-escuro |
| `water.png` | Água (não dá para passar) | azul |
| `portal.png` | Passagem de volta para a clareira | roxo |
| `pegada.png` | Pegada de Rastro no chão (a mesma para todos os encantados, com o nome escrito por cima) | laranja |
| `projectile.png` | Projétil comum | claro |
| `special-projectile.png` | Projétil especial | azul-claro |
| `saci.png` | Personagem: Saci | amarelo |
| `curupira.png` | Personagem: Curupira | amarelo |
| `iara.png` | Personagem: Iara | amarelo |
| `caipora.png` | Personagem: Caipora | amarelo |
| `boitata.png` | Personagem: Boitatá | amarelo |
| `visagem-da-neblina.png` | Visagem da Neblina | vermelho |
| `vulto-da-capoeira.png` | Vulto da Capoeira | vermelho |
| `assombro-do-brejo.png` | Assombro do Brejo | vermelho |

A personagem usa o arquivo do primeiro encantado da comitiva. Encantado ou visagem novos seguem
a mesma regra: o id dele, de `src/data`, com `.png` no fim.

## Ladrilho novo

Ao criar um tipo de ladrilho em `src/data/world.ts`, acrescente a vaga dele em `TILE_SPRITES`,
em `src/components/expedition/sprites.ts`, e uma linha nesta lista. Ladrilho sem vaga aparece em rosa
forte, com o nome `faltando.png`.
