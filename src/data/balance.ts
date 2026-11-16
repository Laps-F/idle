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
  saveVersion: 2, // 2: entraram os amuletos (ver MIGRATIONS em src/store/saveManager.ts)
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

  // Amuletos: queda
  amuletBossDropChance: 0.6, // chance de um chefe derrotado deixar um amuleto
  amuletCommonDropChance: 0.015, // chance de uma visagem comum deixar um amuleto
  amuletBagSize: 20, // quantos amuletos cabem na mochila. Os vestidos não contam.

  // Amuletos: valor de um bônus = base × raridade × escala do estágio × variação
  amuletStageScaling: 0.03, // cada estágio acima do primeiro soma 3% à força do amuleto
  amuletVarianceMin: 0.85, // variação sorteada: de 85%...
  amuletVarianceMax: 1.15, // ...a 115% do valor
  amuletExtraBonusFactor: 0.4, // um bônus secundário vale 40% do bônus base do atributo dele

  // Amuletos: entalhe e desmanche
  amuletLevelBonus: 0.1, // cada nível de entalhe soma 10% aos bônus do amuleto
  carveCostBase: 4, // Cavacos do primeiro entalhe de um amuleto comum
  carveCostGrowth: 1.35, // o custo do entalhe cresce 35% por nível
  carveRefundRate: 0.5, // parte dos Cavacos de entalhe que o desmanche devolve
  salvageStageBonus: 0.04, // cada estágio acima do primeiro soma 4% ao valor do desmanche

  // Relógio do sertão
  dayLengthMs: 24 * SECONDS_PER_MINUTE * MS_PER_SECOND, // 1 dia do jogo = 24 minutos reais
  moonCycleDays: 8, // a lua completa o ciclo em 8 dias do jogo (3h12 reais)
} as const;
