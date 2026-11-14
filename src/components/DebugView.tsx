/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/DebugView.tsx
 * O que faz: painel de debug. Mostra os números crus da store e dá botões
 * para mexer no jogo, para validar o motor sem depender da interface final.
 * Lê tudo direto da store do Zustand. Não liga o laço do jogo: isso é do App.
 *
 * Como adaptar:
 *   - nova métrica: uma linha na lista "metrics" da seção;
 *   - novo botão: uma linha na lista "actions" da seção;
 *   - nova seção: escreva o componente e acrescente uma linha em SECTIONS;
 *   - mostrar só algumas seções: <DebugView sectionIds={['loop', 'save']} />.
 *
 * Mapa:
 *   1. Constantes e tipos
 *   2. Painel
 *   3. Seção: laço do jogo
 *   4. Seção: ausência
 *   5. Seção: combate
 *   6. Seção: recursos
 *   7. Seção: comitiva
 *   8. Seção: melhorias
 *   9. Seção: controles de teste
 *  10. Seção: salvamento
 *  11. Peças reutilizáveis
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import {
  ENCANTADOS,
  ITEMS,
  UPGRADES,
  getEncantado,
  getEnemy,
  getItem,
  getZoneForStage,
} from '../data';
import { getClockInfo } from '../engine/clock';
import { getUpgradeCost, getXpToNextLevel, isUpgradeMaxed } from '../engine/formulas';
import { getSavedGameSize } from '../store/saveManager';
import { useGameStore } from '../store/useGameStore';
import type { OfflineReport } from '../types/game';
import { formatClockTime, formatDuration, formatNumber, formatPercent } from '../utils/format';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

// Valores dos botões de teste
const MANUAL_HIT_FRACTION = 0.25; // fração da vida máxima que o golpe manual tira
const KILL_HIT_FRACTION = 1;
const TEST_GOLD_AMOUNTS = [100, 10_000];

// Ausências que o painel simula. A segunda passa do teto de 8 horas de propósito.
const ABSENCE_OPTIONS = [
  { label: 'Simular 1 hora fora', seconds: 3600 },
  { label: 'Simular 12 horas fora', seconds: 12 * 3600 },
];

// De quanto em quanto tempo o painel mede os ticks por segundo
const TICK_SAMPLE_MS = 1000;

// Apagar tudo pede três cliques seguidos. Parou de clicar, volta ao começo.
const RESET_LABELS = ['Apagar tudo', 'Tem certeza? Clique de novo', 'Última chance: apagar tudo'];
const RESET_TIMEOUT_MS = 4000;

const CODE_PLACEHOLDER =
  'O código exportado aparece aqui. Para importar, cole um código e clique em Importar.';

const SAVE_MESSAGES = {
  copied: 'Código exportado e copiado. Ele também está na caixa de texto.',
  notCopied: 'Código exportado. Copie da caixa de texto.',
  imported: 'Jogo importado.',
  emptyCode: 'Cole um código na caixa de texto antes de importar.',
  reset: 'Jogo apagado. Começou do zero.',
  notSaved: 'Nada gravado: o localStorage não está disponível.',
} as const;

const STYLES = {
  panel: 'mx-auto max-w-5xl p-4 font-mono text-sm text-stone-900',
  heading: 'mb-3 text-lg font-bold',
  grid: 'grid gap-3 md:grid-cols-2',
  section: 'rounded border-2 border-stone-900 bg-amber-50 p-3',
  sectionTitle: 'mb-2 font-bold uppercase tracking-wide',
  metricRow: 'flex justify-between gap-4 border-b border-stone-300 py-0.5',
  metricLabel: 'text-stone-600',
  metricValue: 'text-right font-semibold',
  buttonRow: 'mt-2 flex flex-wrap gap-2',
  button:
    'rounded border border-stone-900 bg-white px-2 py-1 hover:bg-amber-100 ' +
    'disabled:cursor-not-allowed disabled:opacity-40',
  dangerButton:
    'rounded border border-red-800 bg-red-50 px-2 py-1 text-red-900 hover:bg-red-100 ' +
    'disabled:cursor-not-allowed disabled:opacity-40',
  barTrack: 'mt-2 h-3 w-full overflow-hidden rounded border border-stone-900 bg-white',
  barFill: 'h-full bg-red-700',
  textarea: 'mt-2 h-24 w-full rounded border border-stone-900 bg-white p-2 text-xs',
  message: 'mt-2 min-h-5 text-stone-700',
} as const;

interface Metric {
  label: string;
  value: string;
}

interface DebugAction {
  label: string;
  run: () => void;
  disabled?: boolean;
  isDanger?: boolean;
}

interface DebugSectionDef {
  id: string;
  title: string;
  Content: () => ReactNode;
}

interface DebugViewProps {
  sectionIds?: readonly string[]; // quais seções mostrar. Sem esse campo, mostra todas.
}

// Seções do painel, na ordem em que aparecem
const SECTIONS: DebugSectionDef[] = [
  { id: 'loop', title: 'Laço do jogo', Content: LoopSection },
  { id: 'offline', title: 'Ausência', Content: OfflineSection },
  { id: 'combat', title: 'Combate', Content: CombatSection },
  { id: 'resources', title: 'Recursos', Content: ResourcesSection },
  { id: 'party', title: 'Comitiva', Content: PartySection },
  { id: 'upgrades', title: 'Melhorias', Content: UpgradesSection },
  { id: 'controls', title: 'Controles de teste', Content: TestControlsSection },
  { id: 'save', title: 'Salvamento', Content: SaveSection },
];


// =============================================================================
// =============================================================================
// P A I N E L

// Painel de debug completo, ou só com as seções pedidas
export default function DebugView({ sectionIds }: DebugViewProps) {
  const visibleSections = SECTIONS.filter(
    (section) => sectionIds === undefined || sectionIds.includes(section.id),
  );

  return (
    <aside className={STYLES.panel}>
      <h1 className={STYLES.heading}>Encantados: painel de debug</h1>
      <div className={STYLES.grid}>
        {visibleSections.map(({ id, title, Content }) => (
          <Section key={id} title={title}>
            <Content />
          </Section>
        ))}
      </div>
    </aside>
  );
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   L A Ç O   D O   J O G O

// Prova de que o laço está rodando: contador de ticks, ritmo e horário do último tick
function LoopSection() {
  const tickCount = useGameStore((store) => store.tickCount);
  const lastSaveTimestamp = useGameStore((store) => store.lastSaveTimestamp);
  const playTimeSeconds = useGameStore((store) => store.stats.playTimeSeconds);
  const isOpenInAnotherTab = useGameStore((store) => store.isOpenInAnotherTab);
  const ticksPerSecond = useTicksPerSecond();

  const metrics: Metric[] = [
    { label: 'Situação', value: describeLoopStatus(ticksPerSecond, isOpenInAnotherTab) },
    { label: 'Ticks desde que a página abriu', value: String(tickCount) },
    { label: 'Ticks no último segundo', value: String(ticksPerSecond ?? 0) },
    { label: 'Último tick', value: formatClockTime(lastSaveTimestamp) },
    { label: 'Tempo de jogo', value: formatDuration(playTimeSeconds) },
  ];

  return <MetricList metrics={metrics} />;
}

// Conta quantos ticks rodaram a cada segundo. Null enquanto a primeira medida não fecha.
function useTicksPerSecond(): number | null {
  const [ticksPerSecond, setTicksPerSecond] = useState<number | null>(null);

  useEffect(() => {
    let previousCount = useGameStore.getState().tickCount;

    const intervalId = window.setInterval(() => {
      const currentCount = useGameStore.getState().tickCount;
      setTicksPerSecond(currentCount - previousCount);
      previousCount = currentCount;
    }, TICK_SAMPLE_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  return ticksPerSecond;
}

// Texto da situação do laço
function describeLoopStatus(ticksPerSecond: number | null, isOpenInAnotherTab: boolean): string {
  if (isOpenInAnotherTab) {
    return 'Parado: jogo aberto em outra aba';
  }
  if (ticksPerSecond === null) {
    return 'Medindo...';
  }
  return ticksPerSecond > 0 ? 'Rodando' : 'Parado';
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   A U S Ê N C I A

// Simula o jogo fechado por um tempo e mostra o relatório de volta que o motor gerou
function OfflineSection() {
  const offlineReport = useGameStore((store) => store.offlineReport);
  const skipTime = useGameStore((store) => store.debugSkipTime);
  const dismissOfflineReport = useGameStore((store) => store.dismissOfflineReport);

  const actions: DebugAction[] = [
    ...ABSENCE_OPTIONS.map((option) => ({
      label: option.label,
      run: () => skipTime(option.seconds),
    })),
    { label: 'Fechar relatório', run: dismissOfflineReport, disabled: offlineReport === null },
  ];

  return (
    <>
      {offlineReport === null ? (
        <p>Nenhum relatório de ausência aberto.</p>
      ) : (
        <MetricList metrics={getOfflineMetrics(offlineReport)} />
      )}
      <ActionButtons actions={actions} />
    </>
  );
}

// Linhas do relatório de volta: tempo fora, tempo que rendeu e tudo que foi ganho
function getOfflineMetrics(report: OfflineReport): Metric[] {
  const { summary } = report;
  const bosses = `${summary.bossesDefeated} vencidos, ${summary.bossesFailed} perdidos`;

  return [
    { label: 'Tempo fora', value: formatDuration(report.secondsAway) },
    { label: 'Tempo que rendeu', value: formatDuration(report.secondsSimulated) },
    { label: 'Patacas ganhas', value: formatNumber(summary.gold) },
    { label: 'XP por encantado', value: formatNumber(summary.xp) },
    { label: 'Visagens derrotadas', value: formatNumber(summary.kills) },
    { label: 'Chefes', value: bosses },
    { label: 'Estágios avançados', value: String(summary.stagesAdvanced) },
    ...getCounterMetrics(summary.items, (itemId) => getItem(itemId).name),
    ...getCounterMetrics(summary.trails, (id) => `Rastros: ${getEncantado(id).name}`),
    ...getCounterMetrics(summary.levelUps, (id) => `Níveis: ${getEncantado(id).name}`),
  ];
}

// Uma linha para cada entrada de um contador do tipo { id: quantidade }
function getCounterMetrics(
  counters: Record<string, number>,
  describe: (id: string) => string,
): Metric[] {
  return Object.entries(counters).map(([id, amount]) => ({
    label: describe(id),
    value: `+${formatNumber(amount)}`,
  }));
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   C O M B A T E

// Zona, estágio, inimigo em campo e a vida dele
function CombatSection() {
  const combat = useGameStore((store) => store.combat);
  const metrics = useCombatMetrics();

  return (
    <>
      <MetricList metrics={metrics} />
      <ProgressBar fraction={combat.enemyHp / combat.enemyMaxHp} />
    </>
  );
}

// Métricas do combate, lidas da store
function useCombatMetrics(): Metric[] {
  const stage = useGameStore((store) => store.stage);
  const maxStage = useGameStore((store) => store.maxStage);
  const killsInStage = useGameStore((store) => store.killsInStage);
  const autoProgress = useGameStore((store) => store.autoProgress);
  const combat = useGameStore((store) => store.combat);
  const lastSaveTimestamp = useGameStore((store) => store.lastSaveTimestamp);
  const zone = getZoneForStage(stage);
  const clock = getClockInfo(lastSaveTimestamp);
  const currentHp = formatNumber(Math.ceil(combat.enemyHp));
  const enemyHp = `${currentHp} de ${formatNumber(combat.enemyMaxHp)}`;
  const bossTime = combat.isBoss ? `${combat.bossTimeLeft.toFixed(1)} s` : 'sem chefe em campo';

  return [
    { label: 'Zona', value: zone.name },
    { label: 'Estágio', value: `${stage} (liberado até o ${maxStage})` },
    { label: 'Inimigo', value: getEnemy(combat.enemyId).name + (combat.isBoss ? ' (chefe)' : '') },
    { label: 'Vida do inimigo', value: enemyHp },
    { label: 'Tempo do chefe', value: bossTime },
    { label: 'Visagens no estágio', value: `${killsInStage} de ${zone.killsToBoss}` },
    { label: 'Avanço automático', value: autoProgress ? 'ligado' : 'desligado' },
    { label: 'Relógio do sertão', value: `${clock.dayPhase}, lua ${clock.moonPhase}` },
  ];
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   R E C U R S O S

// Patacas, Raízes, Oferendas, Rastros e os totais da partida
function ResourcesSection() {
  const gold = useGameStore((store) => store.gold);
  const roots = useGameStore((store) => store.roots);
  const inventory = useGameStore((store) => store.inventory);
  const trails = useGameStore((store) => store.trails);
  const stats = useGameStore((store) => store.stats);

  const metrics: Metric[] = [
    { label: 'Patacas', value: formatNumber(gold) },
    { label: 'Raízes', value: formatNumber(roots) },
    ...ITEMS.map((item) => ({ label: item.name, value: String(inventory[item.id] ?? 0) })),
    ...getTrailMetrics(trails),
    { label: 'Visagens derrotadas', value: formatNumber(stats.totalKills) },
    { label: 'Chefes vencidos', value: formatNumber(stats.bossesDefeated) },
    { label: 'Patacas ganhas no total', value: formatNumber(stats.totalGoldEarned) },
  ];

  return <MetricList metrics={metrics} />;
}

// Uma linha de Rastros para cada encantado que entra por pacto
function getTrailMetrics(trails: Record<string, number>): Metric[] {
  return ENCANTADOS.filter((encantado) => encantado.pact !== null).map((encantado) => ({
    label: `Rastros: ${encantado.name}`,
    value: `${trails[encantado.id] ?? 0} de ${encantado.pact?.trailsNeeded ?? 0}`,
  }));
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   C O M I T I V A

// Escolha do encantado inicial ou, depois dela, nível, XP e barra de ataque de cada um
function PartySection() {
  const roster = useGameStore((store) => store.roster);
  const party = useGameStore((store) => store.party);
  const attackProgress = useGameStore((store) => store.combat.attackProgress);
  const ownedIds = Object.keys(roster);

  if (ownedIds.length === 0) {
    return <StarterChoice />;
  }

  const metrics: Metric[] = ownedIds.map((encantadoId) => {
    const { level, xp } = roster[encantadoId];
    const xpText = `XP ${formatNumber(xp)} de ${formatNumber(getXpToNextLevel(level))}`;
    const attackText = party.includes(encantadoId)
      ? `ataque ${formatPercent(attackProgress[encantadoId] ?? 0)}`
      : 'fora da comitiva';

    return {
      label: `${getEncantado(encantadoId).name}, nível ${level}`,
      value: `${xpText}, ${attackText}`,
    };
  });

  return <MetricList metrics={metrics} />;
}

// Um botão por encantado inicial. O jogo fica parado até a escolha.
function StarterChoice() {
  const chooseStarter = useGameStore((store) => store.chooseStarter);
  const starters = ENCANTADOS.filter((encantado) => encantado.isStarter);

  const actions: DebugAction[] = starters.map((encantado) => ({
    label: `${encantado.name} (${encantado.origin})`,
    run: () => chooseStarter(encantado.id),
  }));

  return (
    <>
      <p>Escolha quem começa. O motor fica parado até lá.</p>
      <ActionButtons actions={actions} />
    </>
  );
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   M E L H O R I A S

// Um botão de compra por melhoria, com nível e custo
function UpgradesSection() {
  const gold = useGameStore((store) => store.gold);
  const upgradeLevels = useGameStore((store) => store.upgrades);
  const buyUpgrade = useGameStore((store) => store.buyUpgrade);

  const actions: DebugAction[] = UPGRADES.map((upgrade) => {
    const level = upgradeLevels[upgrade.id] ?? 0;
    const cost = getUpgradeCost(upgrade, level);
    const isMaxed = isUpgradeMaxed(upgrade, level);
    const costText = isMaxed ? 'nível máximo' : `${formatNumber(cost)} Patacas`;

    return {
      label: `${upgrade.name}, nível ${level}: ${costText}`,
      run: () => buyUpgrade(upgrade.id),
      disabled: isMaxed || gold < cost,
    };
  });

  return <ActionButtons actions={actions} />;
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   C O N T R O L E S   D E   T E S T E

// Botões que mexem no jogo fora do ritmo normal
function TestControlsSection() {
  const autoProgress = useGameStore((store) => store.autoProgress);
  const hitEnemy = useGameStore((store) => store.debugHitEnemy);
  const grantGold = useGameStore((store) => store.debugGrantGold);
  const setAutoProgress = useGameStore((store) => store.setAutoProgress);
  const challengeBoss = useGameStore((store) => store.challengeBoss);

  const actions: DebugAction[] = [
    {
      label: `Golpe manual (${formatPercent(MANUAL_HIT_FRACTION)} da vida)`,
      run: () => hitEnemy(MANUAL_HIT_FRACTION),
    },
    { label: 'Derrotar inimigo', run: () => hitEnemy(KILL_HIT_FRACTION) },
    ...TEST_GOLD_AMOUNTS.map((amount) => ({
      label: `+${formatNumber(amount)} Patacas`,
      run: () => grantGold(amount),
    })),
    {
      label: autoProgress ? 'Desligar avanço automático' : 'Ligar avanço automático',
      run: () => setAutoProgress(!autoProgress),
    },
    { label: 'Desafiar chefe', run: () => challengeBoss() },
  ];

  return <ActionButtons actions={actions} />;
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   S A L V A M E N T O

// Gravar agora, exportar, importar e apagar tudo, com uma caixa de texto para o código
function SaveSection() {
  const { code, setCode, message, actions } = useSaveControls();

  return (
    <>
      <ActionButtons actions={actions} />
      <textarea
        className={STYLES.textarea}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder={CODE_PLACEHOLDER}
        aria-label="Código do salvamento"
      />
      <p className={STYLES.message} role="status">
        {message}
      </p>
    </>
  );
}

// Estado e botões da seção de salvamento
function useSaveControls() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const resetStep = useStepConfirmation(RESET_LABELS.length, RESET_TIMEOUT_MS);

  const saveNow = (): void => {
    useGameStore.getState().saveNow();
    setMessage(describeSavedGame());
  };

  const exportSave = async (): Promise<void> => {
    const exportedCode = useGameStore.getState().exportSave();
    setCode(exportedCode);
    const wasCopied = await copyToClipboard(exportedCode);
    setMessage(wasCopied ? SAVE_MESSAGES.copied : SAVE_MESSAGES.notCopied);
  };

  const importSave = (): void => {
    setMessage(importFromCode(code));
  };

  const hardReset = (): void => {
    const isConfirmed = resetStep.advance();

    if (isConfirmed) {
      useGameStore.getState().hardReset();
      setCode('');
      setMessage(SAVE_MESSAGES.reset);
    }
  };

  const actions: DebugAction[] = [
    { label: 'Gravar agora', run: saveNow },
    { label: 'Exportar', run: () => void exportSave() },
    { label: 'Importar', run: importSave },
    { label: RESET_LABELS[resetStep.step], run: hardReset, isDanger: true },
  ];

  return { code, setCode, message, actions };
}

// Importa o código e devolve a mensagem do que aconteceu
function importFromCode(code: string): string {
  if (code.trim() === '') {
    return SAVE_MESSAGES.emptyCode;
  }

  const result = useGameStore.getState().importSave(code);
  return result.ok ? SAVE_MESSAGES.imported : result.error;
}

// Texto que confirma a gravação, com o horário e o tamanho do que está no localStorage
function describeSavedGame(): string {
  const savedSize = getSavedGameSize();

  if (savedSize === null) {
    return SAVE_MESSAGES.notSaved;
  }

  const time = formatClockTime(Date.now());
  return `Gravado às ${time}. O salvamento tem ${savedSize} caracteres no localStorage.`;
}

// Copia o texto para a área de transferência. Devolve se deu certo.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Sem permissão ou fora de HTTPS: o código fica na caixa de texto para copiar à mão
    return false;
  }
}

// Confirmação em vários cliques. "advance" devolve true só no último clique.
// Se a pessoa parar de clicar, a contagem volta ao começo depois de "timeoutMs".
function useStepConfirmation(stepCount: number, timeoutMs: number) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step === 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setStep(0), timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [step, timeoutMs]);

  const advance = (): boolean => {
    const isLastStep = step === stepCount - 1;
    setStep(isLastStep ? 0 : step + 1);
    return isLastStep;
  };

  return { step, advance };
}


// =============================================================================
// =============================================================================
// P E Ç A S   R E U T I L I Z Á V E I S

// Caixa com título em volta de uma seção
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={STYLES.section}>
      <h2 className={STYLES.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

// Lista de métricas: nome à esquerda, valor à direita
function MetricList({ metrics }: { metrics: Metric[] }) {
  return (
    <dl>
      {metrics.map((metric) => (
        <div key={metric.label} className={STYLES.metricRow}>
          <dt className={STYLES.metricLabel}>{metric.label}</dt>
          <dd className={STYLES.metricValue}>{metric.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Fileira de botões
function ActionButtons({ actions }: { actions: DebugAction[] }) {
  return (
    <div className={STYLES.buttonRow}>
      {actions.map((action, index) => (
        <button
          key={index}
          type="button"
          className={action.isDanger ? STYLES.dangerButton : STYLES.button}
          disabled={action.disabled}
          onClick={action.run}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

// Barra horizontal de 0 a 1
function ProgressBar({ fraction }: { fraction: number }) {
  const safeFraction = Number.isFinite(fraction) ? Math.min(Math.max(fraction, 0), 1) : 0;

  return (
    <div className={STYLES.barTrack}>
      <div className={STYLES.barFill} style={{ width: formatPercent(safeFraction) }} />
    </div>
  );
}
