/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/arena/FloatingTextLayer.tsx
 * O que faz: os números que sobem na capa a cada golpe e a cada ganho de
 * Patacas. Cada número é um elemento criado direto na página, animado por CSS
 * (classe "float-text") e removido quando a animação termina. Nada disso
 * passa pelo estado do React, então um golpe não redesenha componente nenhum.
 */

import { useRef } from 'react';

import type { CombatFeed } from '../../store/eventViews';
import { formatNumber } from '../../utils/format';
import { useCombatFeed } from '../hooks/useCombatFeed';

// =============================================================================
// =============================================================================
// N Ú M E R O S   F L U T U A N T E S

// Tempo de vida de um número. Um pouco maior que a animação de CSS (900 ms).
const FLOAT_LIFETIME_MS = 950;

// Limite de números na tela ao mesmo tempo, para golpes rápidos não empilharem elementos
const MAX_FLOATING_TEXTS = 14;

// Onde o número de dano nasce, em porcentagem da largura da capa: por cima da figura
const HIT_MIN_LEFT_PERCENT = 30;
const HIT_LEFT_RANGE_PERCENT = 34;

// As Patacas ganhas nascem ao lado da figura, à direita
const GAIN_MIN_LEFT_PERCENT = 66;
const GAIN_LEFT_RANGE_PERCENT = 8;

// Quanto o número pode inclinar para cada lado
const MAX_TILT_DEGREES = 8;

interface FloatingText {
  text: string;
  className: string;
  minLeftPercent: number;
  leftRangePercent: number;
}

const BASE_CLASS = 'float-text';
const CRIT_CLASS = 'float-text float-text-crit';
const GAIN_CLASS = 'float-text float-text-gain';

// Camada vazia por cima da capa. Os números são colocados nela por fora do React.
export function FloatingTextLayer() {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useCombatFeed((feed) => showFeed(layerRef.current, feed));

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
  );
}

// Cria um número para cada golpe do tick e um para as Patacas ganhas
function showFeed(layer: HTMLDivElement | null, feed: CombatFeed): void {
  if (layer === null) {
    return;
  }

  for (const hit of feed.hits) {
    addFloatingText(layer, {
      // Dano menor que 1 apareceria como "0", então o mínimo mostrado é 1
      text: formatNumber(Math.max(1, hit.damage)),
      className: hit.isCrit ? CRIT_CLASS : BASE_CLASS,
      minLeftPercent: HIT_MIN_LEFT_PERCENT,
      leftRangePercent: HIT_LEFT_RANGE_PERCENT,
    });
  }

  if (feed.goldGained > 0) {
    addFloatingText(layer, {
      text: `+${formatNumber(feed.goldGained)}`,
      className: GAIN_CLASS,
      minLeftPercent: GAIN_MIN_LEFT_PERCENT,
      leftRangePercent: GAIN_LEFT_RANGE_PERCENT,
    });
  }
}

// Coloca um número na camada, em posição e inclinação sorteadas, e marca a remoção.
// O sorteio aqui é só de aparência: não interfere no jogo.
function addFloatingText(layer: HTMLDivElement, floating: FloatingText): void {
  if (layer.childElementCount >= MAX_FLOATING_TEXTS) {
    return;
  }

  const element = document.createElement('span');
  const left = floating.minLeftPercent + Math.random() * floating.leftRangePercent;
  const tilt = (Math.random() * 2 - 1) * MAX_TILT_DEGREES;

  element.className = floating.className;
  element.textContent = floating.text;
  element.style.left = `${left}%`;
  element.style.setProperty('--tilt', `${tilt}deg`);
  layer.append(element);

  window.setTimeout(() => element.remove(), FLOAT_LIFETIME_MS);
}
