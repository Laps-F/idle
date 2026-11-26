/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/expedition/sprites.ts
 * O que faz: diz qual imagem vai em cada coisa do mapa. As imagens ainda não
 * existem: enquanto isso, cada coisa é desenhada como um bloco colorido com o
 * nome do arquivo escrito por cima, para ficar marcado onde cada imagem entra.
 *
 * Quando as imagens existirem:
 *   1. Coloque os arquivos em public/sprites/ com os nomes desta lista
 *      (a lista completa também está em docs/SPRITES.md).
 *   2. Troque LOAD_SPRITE_IMAGES para true.
 *   3. Se quiser tirar os nomes escritos por cima, troque SHOW_SPRITE_LABELS para false.
 * Imagem que faltar continua aparecendo como bloco colorido.
 *
 * Mapa:
 *   1. Chaves
 *   2. Ladrilhos e passagens
 *   3. Personagem e visagens
 */

// =============================================================================
// =============================================================================
// C H A V E S

// Ligue quando as imagens estiverem em public/sprites/. Desligado, nenhuma imagem é pedida.
export const LOAD_SPRITE_IMAGES = false;

// Escreve o nome do arquivo em cima de cada bloco colorido
export const SHOW_SPRITE_LABELS = true;

// Pasta das imagens, dentro de public/
export const SPRITE_FOLDER = 'sprites/';

// Uma vaga de imagem: o arquivo que vai entrar e a cor do bloco enquanto ele não existe
export interface SpriteSlot {
  file: string;
  color: string;
}


// =============================================================================
// =============================================================================
// L A D R I L H O S   E   P A S S A G E N S

// Uma vaga por id de ladrilho (src/data/world.ts, TILES)
const TILE_SPRITES: Record<string, SpriteSlot> = {
  grama: { file: 'grass.png', color: '#7f9f56' },
  trilha: { file: 'path.png', color: '#c7a66d' },
  arvore: { file: 'tree.png', color: '#2f5a2b' },
  agua: { file: 'water.png', color: '#3d6f9e' },
};

// Ladrilho sem vaga cadastrada: aparece em rosa forte, para chamar atenção
const MISSING_TILE_SPRITE: SpriteSlot = { file: 'faltando.png', color: '#ff00aa' };

// A passagem de volta para a clareira
export const EXIT_SPRITE: SpriteSlot = { file: 'portal.png', color: '#7a4fa8' };

// Ladrilhos de chão não recebem o nome escrito, para o mapa não virar só texto
export const GROUND_TILE_IDS: readonly string[] = ['grama', 'trilha'];

// Vaga de imagem de um ladrilho
export function getTileSprite(tileId: string): SpriteSlot {
  return TILE_SPRITES[tileId] ?? MISSING_TILE_SPRITE;
}

// Todas as vagas de ladrilho, para a legenda da tela
export function listTileSprites(): { tileId: string; slot: SpriteSlot }[] {
  return Object.entries(TILE_SPRITES).map(([tileId, slot]) => ({ tileId, slot }));
}


// =============================================================================
// =============================================================================
// P E R S O N A G E M   E   V I S A G E N S

// Cor do bloco da personagem e das visagens enquanto as imagens não existem
const PLAYER_COLOR = '#e8b93a';
const ENEMY_COLOR = '#b3301a';

// Vaga da personagem: um arquivo por encantado, com o id dele (saci.png, iara.png)
export function getPlayerSprite(encantadoId: string | null): SpriteSlot {
  return { file: `${encantadoId ?? 'personagem'}.png`, color: PLAYER_COLOR };
}

// Vaga de uma visagem: um arquivo por visagem, com o id dela (visagem-da-neblina.png)
export function getEnemySprite(enemyId: string): SpriteSlot {
  return { file: `${enemyId}.png`, color: ENEMY_COLOR };
}
