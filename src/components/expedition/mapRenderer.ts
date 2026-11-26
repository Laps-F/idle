/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/expedition/mapRenderer.ts
 * O que faz: desenha um quadro da expedição no canvas: ladrilhos, passagem
 * de volta, visagens, projéteis, a personagem, o alcance do golpe, os números
 * que sobem e o painel por cima do mapa (vida, tempo, bolsa e golpe especial).
 * Não decide nada do jogo: só pinta o que recebe (MapView e SceneFrame, de
 * src/store/selectors.ts). Quem chama a cada quadro é ExpeditionCanvas.tsx.
 *
 * Cada coisa é desenhada pela vaga de imagem dela (sprites.ts). Sem imagem,
 * vira um bloco colorido com o nome do arquivo escrito por cima.
 *
 * Mapa:
 *   1. Medidas, cores e tipos
 *   2. Quadro completo
 *   3. Câmera
 *   4. Camadas do mapa: chão, passagem, visagens, projéteis e personagem
 *   5. Números que sobem
 *   6. Painel por cima do mapa
 *   7. Peças de desenho e vagas de imagem
 */

import type { MapView, SceneFrame } from '../../store/expeditionSelectors';
import { formatDuration, formatNumber } from '../../utils/format';
import {
  EXIT_SPRITE,
  getEnemySprite,
  getPlayerSprite,
  getTileSprite,
  GROUND_TILE_IDS,
  LOAD_SPRITE_IMAGES,
  PROJECTILE_SPRITE,
  SHOW_SPRITE_LABELS,
  SPECIAL_PROJECTILE_SPRITE,
  SPRITE_FOLDER,
} from './sprites';
import type { SpriteSlot } from './sprites';

// =============================================================================
// =============================================================================
// M E D I D A S ,   C O R E S   E   T I P O S

// Tamanho de um ladrilho na tela, em pixels
export const TILE_PX = 48;

// Tamanho da janela do canvas, em pixels. O mapa maior que isso anda com a câmera.
export const VIEW_WIDTH_PX = 960;
export const VIEW_HEIGHT_PX = 576;

// Tamanho do desenho da personagem e das visagens, em ladrilhos (a colisão é menor)
const FIGURE_SIZE = 0.8;

// Quanto tempo um número fica na tela, e quanto ele sobe (em ladrilhos)
export const EFFECT_SECONDS = 0.8;
const FLOATING_TEXT_RISE = 1;

const BACKGROUND_COLOR = '#1b1612';
const INK_COLOR = '#1b1612';
const PAPER_COLOR = '#f1ead8';
const HP_COLOR = '#b3301a';
const ATTACK_COLOR = '#e8b93a';
const SPECIAL_COLOR = '#8fd3ff';
const HURT_COLOR = '#ff5a3c';
const RANGE_COLOR = 'rgba(241, 234, 216, 0.35)';
const HUD_BACKGROUND = 'rgba(27, 22, 18, 0.75)';
const LABEL_FONT = '9px sans-serif';
const NAME_FONT = 'bold 11px sans-serif';
const HUD_FONT = 'bold 14px sans-serif';

// Um número que nasce num ponto do mapa, sobe e some aos poucos
export interface MapEffect {
  x: number; // em ladrilhos
  y: number;
  text: string;
  color: string;
  isBig: boolean;
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
 * Desenha um quadro inteiro da expedição.
 *
 * @param context Contexto 2D do canvas, com VIEW_WIDTH_PX por VIEW_HEIGHT_PX.
 * @param map Desenho do mapa (ladrilhos e passagem de volta).
 * @param frame O que está no mapa agora. Null: só o chão aparece.
 * @param effects Números que sobem.
 */
export function drawExpedition(
  context: CanvasRenderingContext2D,
  map: MapView,
  frame: SceneFrame | null,
  effects: readonly MapEffect[],
): void {
  const isSameMap = frame !== null && frame.mapId === map.id;
  const camera = getCamera(map, isSameMap ? frame : null);

  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, VIEW_WIDTH_PX, VIEW_HEIGHT_PX);
  drawTiles(context, map, camera);
  drawExit(context, map, camera);

  if (isSameMap) {
    drawAttackRange(context, frame, camera);
    drawEnemies(context, frame, camera);
    drawProjectiles(context, frame, camera);
    drawPlayer(context, frame, camera);
  }

  drawEffects(context, effects, camera);

  if (isSameMap) {
    drawHud(context, frame);
  }
}


// =============================================================================
// =============================================================================
// C Â M E R A

// A câmera segue a personagem sem mostrar o lado de fora do mapa
function getCamera(map: MapView, frame: SceneFrame | null): Camera {
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
// C A M A D A S   D O   M A P A

// Só os ladrilhos que aparecem na janela
function drawTiles(context: CanvasRenderingContext2D, map: MapView, camera: Camera): void {
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

// Passagem de volta: o bloco e o aviso de para onde leva
function drawExit(context: CanvasRenderingContext2D, map: MapView, camera: Camera): void {
  const x = toScreen(map.exit.x, camera.left);
  const y = toScreen(map.exit.y, camera.top);
  drawSlot(context, EXIT_SPRITE, x, y, TILE_PX, true);
  drawCenteredText(context, '← Clareira', x + TILE_PX / 2, y - 4, NAME_FONT);
}

// Círculo fraco em volta da personagem: a visagem que entra nele leva golpe
function drawAttackRange(context: CanvasRenderingContext2D, frame: SceneFrame, camera: Camera) {
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

// Cada visagem: bloco, nome com o nível e barra de vida
function drawEnemies(context: CanvasRenderingContext2D, frame: SceneFrame, camera: Camera): void {
  const size = FIGURE_SIZE * TILE_PX;

  for (const enemy of frame.enemies) {
    const left = toScreen(enemy.x, camera.left) - size / 2;
    const top = toScreen(enemy.y, camera.top) - size / 2;
    const sprite = getEnemySprite(enemy.enemyId);
    drawSlot(context, sprite, left, top, size, false);
    drawFigureLabel(context, sprite, left + size / 2, top + size + 12);
    drawBar(context, left, top - 7, size, enemy.hpFraction, HP_COLOR);
    drawCenteredText(context, `${enemy.name} ${enemy.level}`, left + size / 2, top - 10, NAME_FONT);
  }
}

// Projéteis: blocos pequenos, sem nome escrito (não cabe)
function drawProjectiles(context: CanvasRenderingContext2D, frame: SceneFrame, camera: Camera) {
  const size = frame.projectileRadius * 2 * TILE_PX;

  for (const projectile of frame.projectiles) {
    const sprite = projectile.isSpecial ? SPECIAL_PROJECTILE_SPRITE : PROJECTILE_SPRITE;
    const left = toScreen(projectile.x, camera.left) - size / 2;
    const top = toScreen(projectile.y, camera.top) - size / 2;
    drawSlot(context, sprite, left, top, size, false);
  }
}

// A personagem (piscando ao levar golpe) e a barra de ataque embaixo dela
function drawPlayer(context: CanvasRenderingContext2D, frame: SceneFrame, camera: Camera): void {
  const size = FIGURE_SIZE * TILE_PX;
  const left = toScreen(frame.playerX, camera.left) - size / 2;
  const top = toScreen(frame.playerY, camera.top) - size / 2;
  const sprite = getPlayerSprite(frame.leaderId);

  drawSlot(context, sprite, left, top, size, false);
  if (frame.isHurt) {
    context.fillStyle = 'rgba(255, 90, 60, 0.6)';
    context.fillRect(left, top, size, size);
  }
  drawBar(context, left, top + size + 3, size, frame.attackProgress, ATTACK_COLOR);
  drawFigureLabel(context, sprite, left + size / 2, top + size + 18);
}


// =============================================================================
// =============================================================================
// N Ú M E R O S   Q U E   S O B E M

// Cada número sobe e some aos poucos
function drawEffects(
  context: CanvasRenderingContext2D,
  effects: readonly MapEffect[],
  camera: Camera,
): void {
  for (const effect of effects) {
    const progress = Math.min(1, effect.ageSeconds / EFFECT_SECONDS);
    const x = toScreen(effect.x, camera.left);
    const y = toScreen(effect.y - progress * FLOATING_TEXT_RISE, camera.top);
    const font = effect.isBig ? 'bold 20px sans-serif' : 'bold 14px sans-serif';

    context.globalAlpha = 1 - progress;
    drawCenteredText(context, effect.text, x, y, font, effect.color);
    context.globalAlpha = 1;
  }
}

// Cor de cada efeito de texto, para quem monta os efeitos (ExpeditionCanvas.tsx)
export const EFFECT_COLORS = {
  hit: PAPER_COLOR,
  crit: ATTACK_COLOR,
  hurt: HURT_COLOR,
} as const;


// =============================================================================
// =============================================================================
// P A I N E L   P O R   C I M A   D O   M A P A

// Vida e golpe especial à esquerda, tempo no meio, bolsa à direita
function drawHud(context: CanvasRenderingContext2D, frame: SceneFrame): void {
  const barWidth = 220;
  const isSpecialReady = frame.specialReadiness >= 1;

  context.fillStyle = HUD_BACKGROUND;
  context.fillRect(0, 0, VIEW_WIDTH_PX, 44);

  drawHudText(context, `Vida ${formatNumber(frame.hp)} / ${formatNumber(frame.maxHp)}`, 12, 18);
  drawBar(context, 12, 26, barWidth, frame.hpFraction, HP_COLOR, 8);

  const specialLabel = isSpecialReady ? 'Espaço: golpe especial pronto' : 'Golpe especial';
  drawHudText(context, specialLabel, 260, 18);
  drawBar(context, 260, 26, 200, frame.specialReadiness, SPECIAL_COLOR, 8);

  drawHudText(context, `Falta ${formatDuration(Math.ceil(frame.secondsLeft))}`, 640, 30, 'center');
  drawHudText(context, `Bolsa: ${formatNumber(frame.lootCount)}`, VIEW_WIDTH_PX - 12, 30, 'right');
}

// Texto do painel, claro sobre o fundo escuro
function drawHudText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign = 'left',
): void {
  context.font = HUD_FONT;
  context.textAlign = align;
  context.textBaseline = 'alphabetic';
  context.fillStyle = PAPER_COLOR;
  context.fillText(text, x, y);
}


// =============================================================================
// =============================================================================
// P E Ç A S   D E   D E S E N H O   E   V A G A S   D E   I M A G E M

// Barra com fundo claro e a parte cheia colorida
function drawBar(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  fraction: number,
  color: string,
  height = 4,
): void {
  const filled = Math.max(0, Math.min(1, fraction)) * width;
  context.fillStyle = PAPER_COLOR;
  context.fillRect(left, top, width, height);
  context.fillStyle = color;
  context.fillRect(left, top, filled, height);
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
