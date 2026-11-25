/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/world/worldRenderer.ts
 * O que faz: desenha um quadro do mapa no canvas: ladrilhos, passagens,
 * visagens, a personagem, o alcance do ataque e os números que sobem.
 * Não decide nada do jogo: só pinta o que recebe (WorldMapView e WorldFrame,
 * de src/store/selectors.ts). Quem chama a cada quadro é WorldCanvas.tsx.
 *
 * Cada coisa é desenhada pela vaga de imagem dela (sprites.ts). Sem imagem,
 * vira um bloco colorido com o nome do arquivo escrito por cima.
 *
 * Mapa:
 *   1. Medidas e tipos
 *   2. Quadro completo
 *   3. Câmera
 *   4. Camadas: chão, passagens, visagens, personagem e números
 *   5. Vagas de imagem
 */

import type { WorldFrame, WorldMapView } from '../../store/selectors';
import {
  getEnemySprite,
  getPlayerSprite,
  getTileSprite,
  GROUND_TILE_IDS,
  LOAD_SPRITE_IMAGES,
  PORTAL_SPRITE,
  SHOW_SPRITE_LABELS,
  SPRITE_FOLDER,
} from './sprites';
import type { SpriteSlot } from './sprites';

// =============================================================================
// =============================================================================
// M E D I D A S   E   T I P O S

// Tamanho de um ladrilho na tela, em pixels
export const TILE_PX = 48;

// Tamanho da janela do canvas, em pixels. O mapa maior que isso anda com a câmera.
export const VIEW_WIDTH_PX = 960;
export const VIEW_HEIGHT_PX = 576;

// Tamanho do desenho da personagem e das visagens, em ladrilhos (a colisão é menor)
const FIGURE_SIZE = 0.8;

// Quanto tempo um número fica subindo, e quanto ele sobe (em ladrilhos)
export const FLOATING_TEXT_SECONDS = 0.8;
const FLOATING_TEXT_RISE = 1;

const BACKGROUND_COLOR = '#1b1612';
const INK_COLOR = '#1b1612';
const PAPER_COLOR = '#f1ead8';
const HP_COLOR = '#b3301a';
const ATTACK_COLOR = '#e8b93a';
const RANGE_COLOR = 'rgba(241, 234, 216, 0.35)';
const LABEL_FONT = '9px sans-serif';
const NAME_FONT = 'bold 11px sans-serif';

// Um número que sobe a partir de um ponto do mapa
export interface FloatingText {
  x: number; // em ladrilhos
  y: number;
  text: string;
  color: string;
  isBig: boolean; // crítico aparece maior
  ageSeconds: number;
}

// Canto de cima e à esquerda da parte do mapa que aparece, em pixels
interface Camera {
  left: number;
  top: number;
}


// =============================================================================
// =============================================================================
// Q U A D R O   C O M P L E T O

/**
 * Desenha um quadro inteiro do mapa.
 *
 * @param context Contexto 2D do canvas, com VIEW_WIDTH_PX por VIEW_HEIGHT_PX.
 * @param map Desenho do mapa (ladrilhos e passagens).
 * @param frame O que está no mapa agora. Null antes do primeiro tick: só o chão aparece.
 * @param floatingTexts Números que estão subindo.
 *
 * Caso de borda: com o quadro de outro mapa (logo depois de uma passagem), as
 * figuras não são desenhadas até o desenho do mapa novo chegar.
 */
export function drawWorld(
  context: CanvasRenderingContext2D,
  map: WorldMapView,
  frame: WorldFrame | null,
  floatingTexts: readonly FloatingText[],
): void {
  const isSameMap = frame !== null && frame.mapId === map.id;
  const camera = getCamera(map, isSameMap ? frame : null);

  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, VIEW_WIDTH_PX, VIEW_HEIGHT_PX);
  drawTiles(context, map, camera);
  drawPortals(context, map, camera);

  if (isSameMap) {
    drawAttackRange(context, frame, camera);
    drawEnemies(context, frame, camera);
    drawPlayer(context, frame, camera);
  }

  drawFloatingTexts(context, floatingTexts, camera);
}


// =============================================================================
// =============================================================================
// C Â M E R A

// A câmera segue a personagem sem mostrar o lado de fora do mapa
function getCamera(map: WorldMapView, frame: WorldFrame | null): Camera {
  const mapWidth = map.width * TILE_PX;
  const mapHeight = map.height * TILE_PX;
  const focusX = frame === null ? mapWidth / 2 : frame.playerX * TILE_PX;
  const focusY = frame === null ? mapHeight / 2 : frame.playerY * TILE_PX;

  return {
    left: clampCamera(focusX - VIEW_WIDTH_PX / 2, mapWidth, VIEW_WIDTH_PX),
    top: clampCamera(focusY - VIEW_HEIGHT_PX / 2, mapHeight, VIEW_HEIGHT_PX),
  };
}

// Limita um eixo da câmera ao mapa. Mapa menor que a janela fica centralizado.
function clampCamera(wanted: number, mapSize: number, viewSize: number): number {
  if (mapSize <= viewSize) {
    return (mapSize - viewSize) / 2;
  }

  return Math.max(0, Math.min(wanted, mapSize - viewSize));
}

// Ponto do mapa (em ladrilhos) -> pixel no canvas
function toScreen(value: number, cameraOffset: number): number {
  return value * TILE_PX - cameraOffset;
}


// =============================================================================
// =============================================================================
// C A M A D A S

// Só os ladrilhos que aparecem na janela
function drawTiles(context: CanvasRenderingContext2D, map: WorldMapView, camera: Camera): void {
  const firstColumn = Math.max(0, Math.floor(camera.left / TILE_PX));
  const firstRow = Math.max(0, Math.floor(camera.top / TILE_PX));
  const lastColumn = Math.min(map.width - 1, Math.ceil((camera.left + VIEW_WIDTH_PX) / TILE_PX));
  const lastRow = Math.min(map.height - 1, Math.ceil((camera.top + VIEW_HEIGHT_PX) / TILE_PX));

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const tileId = map.tiles[row]?.[column] ?? '';
      const x = toScreen(column, camera.left);
      const y = toScreen(row, camera.top);
      const hasLabel = !GROUND_TILE_IDS.includes(tileId);
      drawSlot(context, getTileSprite(tileId), x, y, TILE_PX, hasLabel);
    }
  }
}

// Passagens: o bloco e o nome do mapa para onde levam
function drawPortals(context: CanvasRenderingContext2D, map: WorldMapView, camera: Camera): void {
  for (const portal of map.portals) {
    const x = toScreen(portal.x, camera.left);
    const y = toScreen(portal.y, camera.top);
    drawSlot(context, PORTAL_SPRITE, x, y, TILE_PX, true);
    drawCenteredText(context, `→ ${portal.toName}`, x + TILE_PX / 2, y - 4, NAME_FONT);
  }
}

// Círculo fraco em volta da personagem: a visagem que entra nele leva golpe
function drawAttackRange(context: CanvasRenderingContext2D, frame: WorldFrame, camera: Camera) {
  context.strokeStyle = RANGE_COLOR;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(
    toScreen(frame.playerX, camera.left),
    toScreen(frame.playerY, camera.top),
    frame.attackRange * TILE_PX,
    0,
    2 * Math.PI,
  );
  context.stroke();
}

// Cada visagem: bloco, nome e barra de vida
function drawEnemies(context: CanvasRenderingContext2D, frame: WorldFrame, camera: Camera): void {
  const size = FIGURE_SIZE * TILE_PX;

  for (const enemy of frame.enemies) {
    const left = toScreen(enemy.x, camera.left) - size / 2;
    const top = toScreen(enemy.y, camera.top) - size / 2;
    const sprite = getEnemySprite(enemy.enemyId);
    drawSlot(context, sprite, left, top, size, false);
    drawFigureLabel(context, sprite, left + size / 2, top + size + 12);
    drawBar(context, left, top - 7, size, enemy.hpFraction, HP_COLOR);
    drawCenteredText(context, enemy.name, left + size / 2, top - 10, NAME_FONT);
  }
}

// A personagem e a barra de ataque embaixo dela
function drawPlayer(context: CanvasRenderingContext2D, frame: WorldFrame, camera: Camera): void {
  const size = FIGURE_SIZE * TILE_PX;
  const left = toScreen(frame.playerX, camera.left) - size / 2;
  const top = toScreen(frame.playerY, camera.top) - size / 2;

  const sprite = getPlayerSprite(frame.leadId);
  drawSlot(context, sprite, left, top, size, false);
  drawBar(context, left, top + size + 3, size, frame.attackProgress, ATTACK_COLOR);
  drawFigureLabel(context, sprite, left + size / 2, top + size + 18);
}

// Nome do arquivo embaixo de uma figura, que é pequena demais para o texto caber dentro
function drawFigureLabel(
  context: CanvasRenderingContext2D,
  slot: SpriteSlot,
  x: number,
  y: number,
): void {
  if (SHOW_SPRITE_LABELS && getSpriteImage(slot.file) === null) {
    drawCenteredText(context, slot.file, x, y, LABEL_FONT);
  }
}

// Números que sobem e somem aos poucos
function drawFloatingTexts(
  context: CanvasRenderingContext2D,
  floatingTexts: readonly FloatingText[],
  camera: Camera,
): void {
  for (const floating of floatingTexts) {
    const progress = Math.min(1, floating.ageSeconds / FLOATING_TEXT_SECONDS);
    const x = toScreen(floating.x, camera.left);
    const y = toScreen(floating.y - progress * FLOATING_TEXT_RISE, camera.top);
    const font = floating.isBig ? 'bold 20px sans-serif' : 'bold 14px sans-serif';

    context.globalAlpha = 1 - progress;
    drawCenteredText(context, floating.text, x, y, font, floating.color);
    context.globalAlpha = 1;
  }
}

// Barra fina com fundo claro e a parte cheia colorida
function drawBar(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  fraction: number,
  color: string,
): void {
  const filled = Math.max(0, Math.min(1, fraction)) * width;
  context.fillStyle = PAPER_COLOR;
  context.fillRect(left, top, width, 4);
  context.fillStyle = color;
  context.fillRect(left, top, filled, 4);
}

// Texto centrado num ponto, com contorno escuro para aparecer em qualquer fundo
function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string = PAPER_COLOR,
): void {
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'bottom';
  context.lineWidth = 3;
  context.strokeStyle = INK_COLOR;
  context.strokeText(text, x, y);
  context.fillStyle = color;
  context.fillText(text, x, y);
}


// =============================================================================
// =============================================================================
// V A G A S   D E   I M A G E M

// Imagens já pedidas: a imagem carregada, ou null enquanto carrega ou se não existe
const spriteImages = new Map<string, HTMLImageElement | null>();

/**
 * Desenha uma vaga de imagem: a imagem, se existir, ou o bloco colorido marcado.
 *
 * @param context Contexto 2D do canvas.
 * @param slot Arquivo e cor da vaga (sprites.ts).
 * @param left Canto esquerdo, em pixels.
 * @param top Canto de cima, em pixels.
 * @param size Lado do quadrado, em pixels.
 * @param hasLabel Se o nome do arquivo deve ser escrito por cima do bloco.
 */
function drawSlot(
  context: CanvasRenderingContext2D,
  slot: SpriteSlot,
  left: number,
  top: number,
  size: number,
  hasLabel: boolean,
): void {
  const image = getSpriteImage(slot.file);

  if (image !== null) {
    context.drawImage(image, left, top, size, size);
    return;
  }

  context.fillStyle = slot.color;
  context.fillRect(left, top, size, size);
  context.strokeStyle = 'rgba(27, 22, 18, 0.35)';
  context.lineWidth = 1;
  context.strokeRect(left + 0.5, top + 0.5, size - 1, size - 1);

  if (SHOW_SPRITE_LABELS && hasLabel) {
    context.font = LABEL_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = PAPER_COLOR;
    context.fillText(slot.file, left + size / 2, top + size / 2, size - 2);
  }
}

// Imagem pronta de um arquivo, ou null. O primeiro pedido começa o carregamento.
function getSpriteImage(file: string): HTMLImageElement | null {
  if (!LOAD_SPRITE_IMAGES) {
    return null;
  }
  if (spriteImages.has(file)) {
    return spriteImages.get(file) ?? null;
  }

  const image = new Image();
  spriteImages.set(file, null);
  image.onload = () => spriteImages.set(file, image);
  image.src = `${import.meta.env.BASE_URL}${SPRITE_FOLDER}${file}`;
  return null;
}
