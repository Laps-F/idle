/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/tuning.ts
 * O que faz: os ajustes de teste. Reúne num lugar só todos os números de
 * balanceamento que dá para mudar com o jogo aberto (constantes de
 * src/data/balance.ts, encantados, visagens, quedas, mapas, melhorias e
 * zonas), troca o valor na hora, lembra das mudanças no localStorage e
 * desfaz tudo quando pedido. É o que o painel "Ajustes" mostra.
 *
 * Atenção, exceção à regra "dados não mudam": para os ajustes valerem em todo
 * o jogo sem passar um parâmetro novo por todas as funções, este arquivo
 * troca os números direto nos objetos de src/data. Só este arquivo faz isso,
 * e só a pedido da pessoa. O valor original de cada campo fica guardado
 * (TuningField.defaultValue) e "Desfazer tudo" volta tudo ao que está no código.
 *
 * As mudanças valem para o que for calculado depois: visagens que nascem,
 * próximo golpe, próxima expedição. O que já existe (uma visagem com a vida
 * já sorteada, a vida da expedição em andamento) fica como estava.
 *
 * Para um ajuste virar permanente, copie a lista do painel ("Copiar
 * mudanças") e troque o valor no arquivo de src/data indicado.
 *
 * Mapa:
 *   1. Tipos e constantes
 *   2. Campos de src/data/balance.ts
 *   3. Campos dos outros dados (encantados, visagens, mapas, melhorias, zonas)
 *   4. Consultar e mudar
 *   5. Guardar no localStorage
 */

import {
  BALANCE,
  ENCANTADOS,
  ENEMIES,
  EXPEDITION_LOOT,
  EXPEDITION_MAPS,
  UPGRADES,
  ZONES,
} from '../data';

// =============================================================================
// =============================================================================
// T I P O S   E   C O N S T A N T E S

// Chave do localStorage onde as mudanças ficam guardadas (separada do salvamento do jogo)
export const TUNING_STORAGE_KEY = 'encantados-ajustes';

// Como um campo aparece e quais valores aceita
interface FieldSpec {
  group: string;
  label: string;
  step: number; // passo das setinhas do campo
  min?: number; // menor valor aceito. Padrão: 0.
  isInteger?: boolean; // arredonda para inteiro
}

// Um número ajustável, com o caminho para ler e escrever o valor de verdade
interface TuningField extends FieldSpec {
  id: string; // identificador estável, usado no localStorage (ex.: "balance.enemyBaseHp")
  source: string; // onde mudar de vez no código (ex.: "src/data/balance.ts, enemyBaseHp")
  defaultValue: number; // valor que está no código
  read: () => number;
  write: (value: number) => void;
}

// O que o painel recebe de cada campo
export interface TuningFieldView {
  id: string;
  group: string;
  label: string;
  source: string;
  step: number;
  min: number;
  value: number;
  defaultValue: number;
  isChanged: boolean;
}

// Constantes técnicas que não fazem sentido mexer pelo painel (laço, gravação, versão)
const TECHNICAL_BALANCE_KEYS = [
  'saveVersion',
  'saveIntervalMs',
  'tickIntervalMs',
  'maxSecondsWithEvents',
  'expeditionTickIntervalMs',
  'sceneMaxStepSeconds',
] as const;

type BalanceKey = keyof typeof BALANCE;
type TunableBalanceKey = Exclude<BalanceKey, (typeof TECHNICAL_BALANCE_KEYS)[number]>;

// Nomes dos grupos, na ordem em que aparecem no painel
const GROUP = {
  expedition: 'Expedição: geral',
  player: 'Expedição: personagem',
  projectiles: 'Expedição: projéteis',
  sceneEnemies: 'Expedição: visagens',
  waves: 'Expedição: ondas',
  maps: 'Expedição: mapas',
  expeditionLoot: 'Expedição: saque de cada mapa',
  enemies: 'Visagens: vida e recompensas (clareira e expedição)',
  enemyTypes: 'Visagens: cada tipo',
  drops: 'Quedas de Oferendas',
  encantados: 'Encantados: progressão',
  encantadoTypes: 'Encantados: cada um',
  zones: 'Clareira: zonas e chefes',
  upgrades: 'Melhorias',
  offline: 'Ausência',
  amulets: 'Amuletos',
  rebrota: 'Rebrota',
  clock: 'Relógio do sertão',
} as const;

const DEFAULT_MIN = 0;


// =============================================================================
// =============================================================================
// C A M P O S   D E   S R C / D A T A / B A L A N C E . T S

// Um campo para cada constante. O "satisfies" faz o TypeScript acusar constante sem campo.
const BALANCE_FIELDS = {
  expeditionDurationSeconds: {
    group: GROUP.expedition,
    label: 'Tempo da expedição (segundos)',
    step: 10,
    min: 1,
  },
  expeditionCompletionBonus: {
    group: GROUP.expedition,
    label: 'Bônus de quem aguenta até o fim (0,5 = +50% na bolsa)',
    step: 0.05,
  },
  expeditionHitsPerEnemy: {
    group: GROUP.expedition,
    label: 'Golpes que uma visagem aguenta no nível de partida',
    step: 0.5,
    min: 0.5,
  },

  playerBaseHp: { group: GROUP.player, label: 'Vida base no nível 1', step: 10, min: 1 },
  playerHpPerLevel: {
    group: GROUP.player,
    label: 'Ganho de vida por nível (0,1 = +10% da base)',
    step: 0.01,
  },
  playerSpeed: { group: GROUP.player, label: 'Velocidade (ladrilhos por segundo)', step: 0.1 },
  attackRange: { group: GROUP.player, label: 'Alcance do golpe comum (ladrilhos)', step: 0.1 },
  bodyRadius: {
    group: GROUP.player,
    label: 'Metade da largura do corpo (personagem e visagens)',
    step: 0.05,
    min: 0.05,
  },
  hurtFlashSeconds: { group: GROUP.player, label: 'Tempo piscando ao apanhar (s)', step: 0.05 },
  specialDamageMultiplier: {
    group: GROUP.player,
    label: 'Força do golpe especial (vezes o golpe comum)',
    step: 0.5,
  },
  specialCooldownSeconds: {
    group: GROUP.player,
    label: 'Recarga do golpe especial (s)',
    step: 0.5,
  },

  projectileSpeed: { group: GROUP.projectiles, label: 'Velocidade do comum', step: 0.5, min: 0.1 },
  projectileMaxDistance: {
    group: GROUP.projectiles,
    label: 'Distância máxima do comum',
    step: 0.5,
  },
  specialProjectileSpeed: {
    group: GROUP.projectiles,
    label: 'Velocidade do especial',
    step: 0.5,
    min: 0.1,
  },
  specialProjectileMaxDistance: {
    group: GROUP.projectiles,
    label: 'Distância máxima do especial',
    step: 0.5,
  },
  projectileRadius: {
    group: GROUP.projectiles,
    label: 'Metade da largura do projétil',
    step: 0.05,
  },

  enemyContactHpFraction: {
    group: GROUP.sceneEnemies,
    label: 'Encostada no nível de partida (0,03 = 3% da vida máxima)',
    step: 0.005,
  },
  enemyContactGrowth: {
    group: GROUP.sceneEnemies,
    label: 'Crescimento da encostada por nível acima da partida (×)',
    step: 0.01,
  },
  enemyHitCooldownSeconds: {
    group: GROUP.sceneEnemies,
    label: 'Tempo entre duas batidas da mesma visagem (s)',
    step: 0.1,
  },
  enemyChaseSpeed: { group: GROUP.sceneEnemies, label: 'Velocidade perseguindo', step: 0.1 },
  enemyWanderSpeed: { group: GROUP.sceneEnemies, label: 'Velocidade passeando', step: 0.1 },
  enemyAggroRange: {
    group: GROUP.sceneEnemies,
    label: 'Distância em que começam a perseguir',
    step: 0.5,
  },
  enemyContactRange: {
    group: GROUP.sceneEnemies,
    label: 'Distância em que encostam e batem',
    step: 0.05,
  },
  enemyWanderRadius: { group: GROUP.sceneEnemies, label: 'Raio do passeio', step: 0.5 },
  enemyWaitSecondsMin: {
    group: GROUP.sceneEnemies,
    label: 'Parada mínima no passeio (s)',
    step: 0.5,
  },
  enemyWaitSecondsMax: {
    group: GROUP.sceneEnemies,
    label: 'Parada máxima no passeio (s)',
    step: 0.5,
  },
  enemyMinSpawnDistance: {
    group: GROUP.sceneEnemies,
    label: 'Distância mínima da personagem ao nascer',
    step: 0.5,
  },

  waveStartEnemies: {
    group: GROUP.waves,
    label: 'Visagens no mapa ao partir',
    step: 1,
    isInteger: true,
  },
  waveMaxEnemiesStart: {
    group: GROUP.waves,
    label: 'Teto de visagens no começo',
    step: 1,
    isInteger: true,
  },
  waveMaxEnemiesPerMinute: { group: GROUP.waves, label: 'Aumento do teto por minuto', step: 1 },
  waveSpawnSecondsStart: {
    group: GROUP.waves,
    label: 'Segundos entre visagens novas no começo',
    step: 0.1,
    min: 0.1,
  },
  waveSpawnSecondsMin: {
    group: GROUP.waves,
    label: 'Menor intervalo entre visagens novas (s)',
    step: 0.1,
    min: 0.1,
  },
  waveSpawnSpeedupPerMinute: {
    group: GROUP.waves,
    label: 'Quanto o intervalo encurta por minuto (s)',
    step: 0.1,
  },
  waveLevelUpSeconds: {
    group: GROUP.waves,
    label: 'Segundos para as visagens novas subirem um nível',
    step: 5,
    min: 1,
  },

  enemyBaseHp: { group: GROUP.enemies, label: 'Vida base da visagem no nível 1', step: 1, min: 1 },
  enemyHpGrowth: { group: GROUP.enemies, label: 'Crescimento da vida por nível (×)', step: 0.01 },
  bossHpMultiplier: { group: GROUP.enemies, label: 'Vida do chefe (vezes a visagem)', step: 0.5 },
  goldBase: { group: GROUP.enemies, label: 'Patacas por visagem no nível 1', step: 0.5 },
  goldGrowth: { group: GROUP.enemies, label: 'Crescimento das Patacas por nível (×)', step: 0.01 },
  bossGoldMultiplier: { group: GROUP.enemies, label: 'Patacas do chefe (vezes)', step: 0.5 },
  xpBase: { group: GROUP.enemies, label: 'XP por visagem no nível 1', step: 0.5 },
  xpGrowth: { group: GROUP.enemies, label: 'Crescimento do XP por nível (×)', step: 0.01 },
  bossXpMultiplier: { group: GROUP.enemies, label: 'XP do chefe (vezes)', step: 0.5 },

  xpToLevelBase: { group: GROUP.encantados, label: 'XP para subir do nível 1', step: 1, min: 1 },
  xpToLevelExponent: {
    group: GROUP.encantados,
    label: 'Expoente do XP por nível (mais alto: sobe mais devagar)',
    step: 0.05,
  },
  damagePerLevel: {
    group: GROUP.encantados,
    label: 'Ganho de dano por nível (0,1 = +10% do ataque base)',
    step: 0.01,
  },
  baseCritChance: { group: GROUP.encantados, label: 'Chance de crítico (0 a 1)', step: 0.01 },
  critMultiplier: { group: GROUP.encantados, label: 'Dano do crítico (vezes)', step: 0.1 },
  maxPartySize: {
    group: GROUP.encantados,
    label: 'Tamanho máximo da comitiva',
    step: 1,
    min: 1,
    isInteger: true,
  },

  offlineThresholdSeconds: {
    group: GROUP.offline,
    label: 'Tempo fora que já conta como ausência (s)',
    step: 10,
    min: 1,
  },
  offlineCapSeconds: { group: GROUP.offline, label: 'Teto da ausência (s)', step: 600 },
  offlineEfficiency: { group: GROUP.offline, label: 'Rendimento da ausência (0 a 1)', step: 0.05 },

  amuletBossDropChance: { group: GROUP.amulets, label: 'Chance por chefe (0 a 1)', step: 0.05 },
  amuletCommonDropChance: {
    group: GROUP.amulets,
    label: 'Chance por visagem comum (0 a 1)',
    step: 0.005,
  },
  amuletBagSize: {
    group: GROUP.amulets,
    label: 'Tamanho da mochila',
    step: 1,
    isInteger: true,
  },
  amuletStageScaling: { group: GROUP.amulets, label: 'Ganho de força por estágio', step: 0.01 },
  amuletVarianceMin: { group: GROUP.amulets, label: 'Variação mínima do sorteio', step: 0.05 },
  amuletVarianceMax: { group: GROUP.amulets, label: 'Variação máxima do sorteio', step: 0.05 },
  amuletExtraBonusFactor: {
    group: GROUP.amulets,
    label: 'Força do bônus secundário (parte do base)',
    step: 0.05,
  },
  amuletLevelBonus: { group: GROUP.amulets, label: 'Ganho por nível de entalhe', step: 0.01 },
  carveCostBase: { group: GROUP.amulets, label: 'Cavacos do primeiro entalhe', step: 1 },
  carveCostGrowth: {
    group: GROUP.amulets,
    label: 'Crescimento do custo do entalhe (×)',
    step: 0.05,
  },
  carveRefundRate: {
    group: GROUP.amulets,
    label: 'Devolução do entalhe no desmanche (0 a 1)',
    step: 0.05,
  },
  salvageStageBonus: { group: GROUP.amulets, label: 'Ganho do desmanche por estágio', step: 0.01 },

  rootsBonusPerRoot: {
    group: GROUP.rebrota,
    label: 'Bônus de dano e Patacas por Raiz',
    step: 0.01,
  },
  rootsStageDivisor: {
    group: GROUP.rebrota,
    label: 'Divisor do estágio nas Raízes',
    step: 1,
    min: 1,
  },
  rootsExponent: { group: GROUP.rebrota, label: 'Expoente das Raízes', step: 0.1 },
  rebrotaMinRoots: { group: GROUP.rebrota, label: 'Raízes mínimas para rebrotar', step: 1 },
  rebrotaFirstStage: { group: GROUP.rebrota, label: 'Estágio da primeira Rebrota', step: 1 },
  rebrotaWorthRatio: { group: GROUP.rebrota, label: 'Aviso na aba (parte das Raízes)', step: 0.05 },
  rebrotaStageMargin: { group: GROUP.rebrota, label: 'Margem do atalho até o recorde', step: 1 },
  startGoldKills: { group: GROUP.rebrota, label: 'Visagens de Patacas da bolsa herdada', step: 5 },

  dayLengthMs: {
    group: GROUP.clock,
    label: 'Duração de um dia do jogo (ms)',
    step: 60000,
    min: 1000,
  },
  moonCycleDays: { group: GROUP.clock, label: 'Dias do jogo por ciclo da lua', step: 1, min: 1 },
} satisfies Record<TunableBalanceKey, FieldSpec>;

// Campos das constantes de balanceamento
function createBalanceFields(): TuningField[] {
  const balance = BALANCE as unknown as Record<string, number>;

  return Object.entries(BALANCE_FIELDS).map(([key, spec]: [string, FieldSpec]) => ({
    ...spec,
    id: `balance.${key}`,
    source: `src/data/balance.ts, ${key}`,
    defaultValue: balance[key] ?? 0,
    read: () => balance[key] ?? 0,
    write: (value: number) => {
      balance[key] = value;
    },
  }));
}


// =============================================================================
// =============================================================================
// C A M P O S   D O S   O U T R O S   D A D O S

// Campo de um número dentro de um objeto de src/data
function createObjectField<Target extends object>(
  target: Target,
  key: keyof Target & string,
  info: FieldSpec & { id: string; source: string },
): TuningField {
  const record = target as unknown as Record<string, number>;

  return {
    ...info,
    defaultValue: record[key] ?? 0,
    read: () => record[key] ?? 0,
    write: (value: number) => {
      record[key] = value;
    },
  };
}

// Bônus de nível de cada mapa de expedição, somado ao nível de partida de quem sai
function createMapFields(): TuningField[] {
  return EXPEDITION_MAPS.map((map) =>
    createObjectField(map, 'levelBonus', {
      id: `map.${map.id}.levelBonus`,
      source: `src/data/world.ts, ${map.id}, levelBonus`,
      group: GROUP.maps,
      label: `${map.name}: níveis acima do poder de quem sai`,
      step: 1,
      min: 0,
      isInteger: true,
    }),
  );
}

// Multiplicadores de cada tipo de visagem e chance de cada queda
function createEnemyFields(): TuningField[] {
  return ENEMIES.flatMap((enemy) => {
    const source = `src/data/enemies.ts, ${enemy.id}`;
    const multipliers = (['hpMultiplier', 'goldMultiplier', 'xpMultiplier'] as const).map((key) =>
      createObjectField(enemy, key, {
        id: `enemy.${enemy.id}.${key}`,
        source: `${source}, ${key}`,
        group: GROUP.enemyTypes,
        label: `${enemy.name}: ${MULTIPLIER_LABELS[key]}`,
        step: 0.05,
      }),
    );
    const drops = enemy.drops.map((drop, index) =>
      createObjectField(drop, 'chance', {
        id: `enemy.${enemy.id}.drop${index}.chance`,
        source: `${source}, drops[${index}].chance`,
        group: GROUP.drops,
        label: `${enemy.name}: chance de ${drop.itemId} (0 a 1)`,
        step: 0.01,
      }),
    );
    return [...multipliers, ...drops];
  });
}

const MULTIPLIER_LABELS = {
  hpMultiplier: 'vida e dano (vezes)',
  goldMultiplier: 'Patacas (vezes)',
  xpMultiplier: 'XP (vezes)',
} as const;

// Saque de cada mapa: multiplicadores, chance de amuleto e chance de cada Oferenda
function createExpeditionLootFields(): TuningField[] {
  return EXPEDITION_LOOT.flatMap((loot) => {
    const source = `src/data/expeditionLoot.ts, ${loot.mapId}`;
    const numbers = (['goldMultiplier', 'xpMultiplier', 'amuletChance'] as const).map((key) =>
      createObjectField(loot, key, {
        id: `loot.${loot.mapId}.${key}`,
        source: `${source}, ${key}`,
        group: GROUP.expeditionLoot,
        label: `${loot.mapId}: ${LOOT_LABELS[key]}`,
        step: key === 'amuletChance' ? 0.01 : 0.5,
      }),
    );
    const drops = loot.drops.map((drop, index) =>
      createObjectField(drop, 'chance', {
        id: `loot.${loot.mapId}.drop${index}.chance`,
        source: `${source}, drops[${index}].chance`,
        group: GROUP.expeditionLoot,
        label: `${loot.mapId}: chance de ${drop.itemId} (0 a 1)`,
        step: 0.01,
      }),
    );
    return [...numbers, ...drops];
  });
}

const LOOT_LABELS = {
  goldMultiplier: 'Patacas por visagem (vezes a fórmula da clareira)',
  xpMultiplier: 'XP por visagem (vezes a fórmula da clareira)',
  amuletChance: 'chance de amuleto por visagem (0 a 1)',
} as const;

// Ataque base e intervalo de cada encantado
function createEncantadoFields(): TuningField[] {
  return ENCANTADOS.flatMap((encantado) => {
    const source = `src/data/encantados.ts, ${encantado.id}`;
    return [
      createObjectField(encantado, 'baseAttack', {
        id: `encantado.${encantado.id}.baseAttack`,
        source: `${source}, baseAttack`,
        group: GROUP.encantadoTypes,
        label: `${encantado.name}: dano base`,
        step: 0.5,
      }),
      createObjectField(encantado, 'attackInterval', {
        id: `encantado.${encantado.id}.attackInterval`,
        source: `${source}, attackInterval`,
        group: GROUP.encantadoTypes,
        label: `${encantado.name}: segundos entre golpes`,
        step: 0.05,
        min: 0.05,
      }),
    ];
  });
}

// Visagens até o chefe, tempo do chefe e chance de Rastro de cada zona
function createZoneFields(): TuningField[] {
  return ZONES.flatMap((zone) => {
    const source = `src/data/zones.ts, ${zone.id}`;
    const encounters = zone.encounters.map((encounter) =>
      createObjectField(encounter, 'trailChance', {
        id: `zone.${zone.id}.${encounter.encantadoId}.trailChance`,
        source: `${source}, encounters (${encounter.encantadoId}), trailChance`,
        group: GROUP.zones,
        label: `${zone.name}: chance de Rastro de ${encounter.encantadoId} (0 a 1)`,
        step: 0.01,
      }),
    );
    return [
      createObjectField(zone, 'killsToBoss', {
        id: `zone.${zone.id}.killsToBoss`,
        source: `${source}, killsToBoss`,
        group: GROUP.zones,
        label: `${zone.name}: visagens até o chefe`,
        step: 1,
        min: 1,
        isInteger: true,
      }),
      createObjectField(zone, 'bossTimeLimit', {
        id: `zone.${zone.id}.bossTimeLimit`,
        source: `${source}, bossTimeLimit`,
        group: GROUP.zones,
        label: `${zone.name}: tempo para vencer o chefe (s)`,
        step: 1,
        min: 1,
      }),
      ...encounters,
    ];
  });
}

// Custo e bônus de cada melhoria
function createUpgradeFields(): TuningField[] {
  return UPGRADES.flatMap((upgrade) => {
    const source = `src/data/upgrades.ts, ${upgrade.id}`;
    const field = (key: 'baseCost' | 'costFactor' | 'bonusPerLevel', label: string, step: number) =>
      createObjectField(upgrade, key, {
        id: `upgrade.${upgrade.id}.${key}`,
        source: `${source}, ${key}`,
        group: GROUP.upgrades,
        label: `${upgrade.name}: ${label}`,
        step,
      });
    return [
      field('baseCost', 'custo do nível 1', 1),
      field('costFactor', 'crescimento do custo (×)', 0.01),
      field('bonusPerLevel', 'bônus por nível', 0.01),
    ];
  });
}

// Todos os campos, montados uma vez, com o valor do código guardado como padrão
const FIELDS: TuningField[] = [
  ...createBalanceFields(),
  ...createMapFields(),
  ...createExpeditionLootFields(),
  ...createEnemyFields(),
  ...createEncantadoFields(),
  ...createZoneFields(),
  ...createUpgradeFields(),
];

const FIELDS_BY_ID = new Map(FIELDS.map((field) => [field.id, field]));
const GROUP_ORDER: readonly string[] = Object.values(GROUP);


// =============================================================================
// =============================================================================
// C O N S U L T A R   E   M U D A R

// Todos os campos, na ordem dos grupos, com o valor atual e o do código
export function listTuningFields(): TuningFieldView[] {
  return [...FIELDS]
    .sort((first, second) => GROUP_ORDER.indexOf(first.group) - GROUP_ORDER.indexOf(second.group))
    .map((field) => {
      const value = field.read();
      return {
        id: field.id,
        group: field.group,
        label: field.label,
        source: field.source,
        step: field.step,
        min: field.min ?? DEFAULT_MIN,
        value,
        defaultValue: field.defaultValue,
        isChanged: value !== field.defaultValue,
      };
    });
}

/**
 * Troca o valor de um campo na hora e guarda a mudança no localStorage.
 *
 * @param id Identificador do campo (TuningFieldView.id).
 * @param value Valor novo.
 * @returns true se o valor foi aceito. False para campo que não existe ou valor que não é
 *          número, ou abaixo do mínimo do campo.
 *
 * Caso de borda: campo de inteiro arredonda o valor.
 */
export function setTuningValue(id: string, value: number): boolean {
  const field = FIELDS_BY_ID.get(id);
  const minimum = field?.min ?? DEFAULT_MIN;

  if (field === undefined || !Number.isFinite(value) || value < minimum) {
    return false;
  }

  field.write(field.isInteger === true ? Math.round(value) : value);
  saveChanges();
  return true;
}

// Volta um campo ao valor do código. Null volta todos.
export function resetTuning(id: string | null): void {
  const targets = id === null ? FIELDS : FIELDS.filter((field) => field.id === id);

  for (const field of targets) {
    field.write(field.defaultValue);
  }

  saveChanges();
}

// Quantos campos estão diferentes do código
export function countTuningChanges(): number {
  return FIELDS.filter((field) => field.read() !== field.defaultValue).length;
}

// Lista das mudanças em texto, uma por linha, dizendo onde mudar de vez no código
export function describeTuningChanges(): string {
  return FIELDS.filter((field) => field.read() !== field.defaultValue)
    .map((field) => `${field.source}: ${field.defaultValue} -> ${field.read()}`)
    .join('\n');
}


// =============================================================================
// =============================================================================
// G U A R D A R   N O   L O C A L S T O R A G E

/**
 * Aplica as mudanças guardadas no localStorage. Chame uma vez, ao abrir o jogo.
 *
 * @returns Quantas mudanças foram aplicadas.
 *
 * Casos de borda: texto que não é JSON, campo que não existe mais e valor
 * inválido são ignorados. Sem localStorage (navegador bloqueado), não faz nada.
 */
export function loadSavedTuning(): number {
  const saved = readSavedChanges();
  let applied = 0;

  for (const [id, value] of Object.entries(saved)) {
    const field = FIELDS_BY_ID.get(id);

    if (field !== undefined && typeof value === 'number' && Number.isFinite(value)) {
      field.write(value);
      applied += 1;
    }
  }

  return applied;
}

// Lê o objeto { id: valor } guardado. Qualquer problema vira objeto vazio.
function readSavedChanges(): Record<string, unknown> {
  try {
    const text = localStorage.getItem(TUNING_STORAGE_KEY);
    const parsed: unknown = text === null ? {} : JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Guarda só os campos diferentes do código. Sem mudança nenhuma, apaga a chave.
function saveChanges(): void {
  const changes = Object.fromEntries(
    FIELDS.filter((field) => field.read() !== field.defaultValue).map((field) => [
      field.id,
      field.read(),
    ]),
  );

  try {
    if (Object.keys(changes).length === 0) {
      localStorage.removeItem(TUNING_STORAGE_KEY);
    } else {
      localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(changes));
    }
  } catch {
    // Sem localStorage, os ajustes valem só até fechar a página
  }
}
