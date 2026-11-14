/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/utils/format.ts
 * O que faz: transforma números, durações e horários em texto para a tela.
 *
 * Mapa:
 *   1. Constantes
 *   2. Números
 *   3. Tempo
 */

// =============================================================================
// =============================================================================
// C O N S T A N T E S

// Sufixos de mil em mil: K = mil, M = milhão, B = bilhão, T = trilhão, Qa, Qi
const NUMBER_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
const THOUSAND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;


// =============================================================================
// =============================================================================
// N Ú M E R O S

// 950 -> "950", 1234 -> "1,23K", 5600000 -> "5,60M". Acima de Qi usa notação científica.
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Math.abs(value) < THOUSAND) {
    return String(Math.floor(value));
  }

  const suffixIndex = Math.floor(Math.log10(Math.abs(value)) / 3);

  if (suffixIndex >= NUMBER_SUFFIXES.length) {
    return value.toExponential(2).replace('.', ',');
  }

  const scaled = value / Math.pow(THOUSAND, suffixIndex);
  return scaled.toFixed(2).replace('.', ',') + NUMBER_SUFFIXES[suffixIndex];
}

// 0.256 -> "26%"
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}


// =============================================================================
// =============================================================================
// T E M P O

// 75 -> "1min 15s", 3725 -> "1h 02min 05s"
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const remainingSeconds = seconds % SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `${hours}h ${padTwoDigits(minutes)}min ${padTwoDigits(remainingSeconds)}s`;
  }
  if (minutes > 0) {
    return `${minutes}min ${padTwoDigits(remainingSeconds)}s`;
  }
  return `${remainingSeconds}s`;
}

// Instante em milissegundos -> "19:12:05" no horário do aparelho
export function formatClockTime(timestamp: number): string {
  const date = new Date(timestamp);
  const parts = [date.getHours(), date.getMinutes(), date.getSeconds()];
  return parts.map(padTwoDigits).join(':');
}

// 5 -> "05"
function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
