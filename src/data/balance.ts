/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/balance.ts
 * O que faz: guarda todas as constantes de balanceamento e de configuração.
 * Para mudar o ritmo do jogo, mexa aqui. O motor não tem número solto.
 *
 * Mapa:
 *   1. Unidades de tempo
 *   2. Constantes de balanceamento
 */

// =============================================================================
// =============================================================================
// U N I D A D E S   D E   T E M P O

export const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;


// =============================================================================
// =============================================================================
// C O N S T A N T E S   D E   B A L A N C E A M E N T O

export const BALANCE = {
  // Salvamento
  saveVersion: 1,
  saveIntervalMs: 5 * MS_PER_SECOND, // intervalo mínimo entre gravações no localStorage

  // Laço do jogo
  tickIntervalMs: 100,
  maxSecondsWithEvents: 1, // acima disso a aba estava em segundo plano e os eventos são descartados

  // Progresso offline
  offlineThresholdSeconds: 2 * SECONDS_PER_MINUTE, // intervalo maior que isso conta como ausência
  offlineCapSeconds: 8 * SECONDS_PER_HOUR,
  offlineEfficiency: 0.5,

  // Comitiva
  maxPartySize: 3,

  // Visagens: vida = enemyBaseHp × enemyHpGrowth^(estágio − 1)
  enemyBaseHp: 10,
  enemyHpGrowth: 1.18,
  bossHpMultiplier: 8,

  // Patacas: goldBase × goldGrowth^(estágio − 1)
  goldBase: 2,
  goldGrowth: 1.15,
  bossGoldMultiplier: 5,

  // XP por visagem: xpBase × xpGrowth^(estágio − 1)
  xpBase: 4,
  xpGrowth: 1.14,
  bossXpMultiplier: 5,

  // XP para subir de nível: xpToLevelBase × nível^xpToLevelExponent
  xpToLevelBase: 20,
  xpToLevelExponent: 1.6,

  // Dano: ataque base × (1 + damagePerLevel × nível) × multiplicadores
  damagePerLevel: 0.1,
  baseCritChance: 0.05,
  critMultiplier: 2,

  // Rebrota: Raízes = piso((maior estágio ÷ rootsStageDivisor)^rootsExponent)
  rootsBonusPerRoot: 0.05, // bônus de dano e de Patacas por Raiz
  rootsStageDivisor: 10,
  rootsExponent: 1.5,

  // Relógio do sertão
  dayLengthMs: 24 * SECONDS_PER_MINUTE * MS_PER_SECOND, // 1 dia do jogo = 24 minutos reais
  moonCycleDays: 8, // a lua completa o ciclo em 8 dias do jogo (3h12 reais)
} as const;
