/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/DebugView.tsx
 * O que faz: painel de debug. Mostra os números crus da store e dá botões
 * para mexer no jogo, para validar o motor sem depender da interface final.
 *
 * Componente "burro": só mostra o que recebe dos seletores da store e chama
 * ações da store. Não consulta src/data, não chama src/domain e não faz conta
 * de jogo. Os dados chegam prontos de src/store/selectors.ts. O painel também
 * não liga o laço do jogo: isso é do App.
 *
 * Como adaptar:
 *   - nova métrica: uma linha na lista "metrics" da seção (se o dado ainda não
 *     chega pronto, acrescente o campo na visão em src/store/selectors.ts);
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

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  selectCombatView,
  selectLoopView,
  selectOfflineView,
  selectPartyView,
  selectResourcesView,
  selectUpgradeViews,
} from '../store/selectors';
import type { CombatView, NamedAmount, OfflineView, PartyView } from '../store/selectors';
import type { SaveReceipt } from '../store/types';
import { useGameStore } from '../store/useGameStore';
import { formatClockTime, formatDuration, formatNumber, formatPercent } from '../utils/format';

// =============================================================================
// =============================================================================
// C O N S T A N T E S   E   T I P O S

// Valores dos botões de teste
const MANUAL_HIT_FRACTION = 0.25; // fração da vida máxima que o golpe manual tira
const KILL_HIT_FRACTION = 1;
const TEST_GOLD_AMOUNTS = [100, 10_000];
const DEBUG_ROOTS_AMOUNT = 10;

// Ausências que o painel simula. A segunda passa do teto de 8 horas de propósito.
const ABSENCE_OPTIONS = [
  { label: 'Simular 1 hora fora', seconds: 3600 },
  { label: 'Simular 12 horas fora', seconds: 12 * 3600 },
];

// De quanto em quanto tempo o painel mede os ticks por segundo
const RATE_SAMPLE_MS = 1000;

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
  const loop = useGameStore(selectLoopView);
  const ticksPerSecond = useRatePerSecond(loop.tickCount);

  const metrics: Metric[] = [
    { label: 'Situação', value: describeLoopStatus(ticksPerSecond, loop.isOpenInAnotherTab) },
    { label: 'Ticks desde que a página abriu', value: String(loop.tickCount) },
    { label: 'Ticks no último segundo', value: String(ticksPerSecond ?? 0) },
    { label: 'Último tick', value: formatClockTime(loop.lastTickTimestamp) },
    { label: 'Tempo de jogo', value: formatDuration(loop.playTimeSeconds) },
  ];

  return <MetricList metrics={metrics} />;
}

// Mede quanto um contador sobe por segundo. Null enquanto a primeira medida não fecha.
function useRatePerSecond(counter: number): number | null {
  const latestCounter = useRef(counter);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    latestCounter.current = counter;
  }, [counter]);

  useEffect(() => {
    let previousCounter = latestCounter.current;

    const intervalId = window.setInterval(() => {
      setRate(latestCounter.current - previousCounter);
      previousCounter = latestCounter.current;
    }, RATE_SAMPLE_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  return rate;
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
  const offline = useGameStore(selectOfflineView);
  const skipTime = useGameStore((store) => store.debugSkipTime);
  const dismissOfflineReport = useGameStore((store) => store.dismissOfflineReport);

  const actions: DebugAction[] = [
    ...ABSENCE_OPTIONS.map((option) => ({
      label: option.label,
      run: () => skipTime(option.seconds),
    })),
    { label: 'Fechar relatório', run: dismissOfflineReport, disabled: offline === null },
  ];

  return (
    <>
      {offline === null ? (
        <p>Nenhum relatório de ausência aberto.</p>
      ) : (
        <MetricList metrics={getOfflineMetrics(offline)} />
      )}
      <ActionButtons actions={actions} />
    </>
  );
}

// Linhas do relatório de volta: tempo fora, tempo que rendeu e tudo que foi ganho
function getOfflineMetrics(offline: OfflineView): Metric[] {
  const bosses = `${offline.bossesDefeated} vencidos, ${offline.bossesFailed} perdidos`;

  return [
    { label: 'Tempo fora', value: formatDuration(offline.secondsAway) },
    { label: 'Tempo que rendeu', value: formatDuration(offline.secondsSimulated) },
    { label: 'Patacas ganhas', value: formatNumber(offline.gold) },
    { label: 'XP por encantado', value: formatNumber(offline.xp) },
    { label: 'Visagens derrotadas', value: formatNumber(offline.kills) },
    { label: 'Chefes', value: bosses },
    { label: 'Estágios avançados', value: String(offline.stagesAdvanced) },
    ...getGainMetrics(offline.items, ''),
    ...getGainMetrics(offline.trails, 'Rastros: '),
    ...getGainMetrics(offline.levelUps, 'Níveis: '),
  ];
}

// Uma linha "+quantidade" para cada ganho da lista
function getGainMetrics(gains: readonly NamedAmount[], labelPrefix: string): Metric[] {
  return gains.map((gain) => ({
    label: labelPrefix + gain.name,
    value: `+${formatNumber(gain.amount)}`,
  }));
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   C O M B A T E

// Zona, estágio, inimigo em campo e a vida dele
function CombatSection() {
  const combat = useGameStore(selectCombatView);

  return (
    <>
      <MetricList metrics={getCombatMetrics(combat)} />
      <ProgressBar fraction={combat.enemyHpFraction} />
    </>
  );
}

// Linhas do combate
function getCombatMetrics(combat: CombatView): Metric[] {
  const currentHp = formatNumber(Math.ceil(combat.enemyHp));
  const bossTime = combat.isBoss ? `${combat.bossTimeLeft.toFixed(1)} s` : 'sem chefe em campo';

  return [
    { label: 'Zona', value: combat.zoneName },
    { label: 'Estágio', value: `${combat.stage} (liberado até o ${combat.maxStage})` },
    { label: 'Inimigo', value: combat.enemyName + (combat.isBoss ? ' (chefe)' : '') },
    { label: 'Vida do inimigo', value: `${currentHp} de ${formatNumber(combat.enemyMaxHp)}` },
    { label: 'Tempo do chefe', value: bossTime },
    { label: 'Visagens no estágio', value: `${combat.killsInStage} de ${combat.killsToBoss}` },
    { label: 'Avanço automático', value: combat.autoProgress ? 'ligado' : 'desligado' },
    { label: 'Relógio do sertão', value: `${combat.dayPhase}, lua ${combat.moonPhase}` },
  ];
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   R E C U R S O S

// Patacas, Raízes, Oferendas, Rastros e os totais da partida
function ResourcesSection() {
  const resources = useGameStore(selectResourcesView);

  const metrics: Metric[] = [
    { label: 'Patacas', value: formatNumber(resources.gold) },
    { label: 'Raízes', value: formatNumber(resources.roots) },
    ...resources.items.map((item) => ({ label: item.name, value: String(item.amount) })),
    ...resources.trails.map((trail) => ({
      label: `Rastros: ${trail.name}`,
      value: `${trail.owned} de ${trail.needed}`,
    })),
    { label: 'Cavacos', value: formatNumber(resources.shavings) },
    { label: 'Amuletos na mochila', value: String(resources.amuletsInBag) },
    { label: 'Amuletos vestidos', value: String(resources.amuletsWorn) },
    { label: 'Amuletos encontrados no total', value: formatNumber(resources.amuletsFound) },
    { label: 'Edição do folheto', value: String(resources.edition) },
    { label: 'Raízes livres', value: formatNumber(resources.freeRoots) },
    { label: 'Recorde de edições passadas', value: String(resources.recordStage) },
    { label: 'Rebrotar agora rende', value: `${resources.rebrotaGain} Raízes` },
    { label: 'Visagens derrotadas', value: formatNumber(resources.totalKills) },
    { label: 'Chefes vencidos', value: formatNumber(resources.bossesDefeated) },
    { label: 'Patacas ganhas no total', value: formatNumber(resources.totalGoldEarned) },
  ];

  return <MetricList metrics={metrics} />;
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   C O M I T I V A

// Escolha do encantado inicial ou, depois dela, nível, XP e barra de ataque de cada um
function PartySection() {
  const party = useGameStore(selectPartyView);

  if (!party.hasStarter) {
    return <StarterChoice starters={party.starters} />;
  }

  const metrics: Metric[] = party.members.map((member) => {
    const xpText = `XP ${formatNumber(member.xp)} de ${formatNumber(member.xpToNextLevel)}`;
    const attackText = member.isInParty
      ? `ataque ${formatPercent(member.attackProgress)}`
      : 'fora da comitiva';

    return { label: `${member.name}, nível ${member.level}`, value: `${xpText}, ${attackText}` };
  });

  return <MetricList metrics={metrics} />;
}

// Um botão por encantado inicial. O jogo fica parado até a escolha.
function StarterChoice({ starters }: { starters: PartyView['starters'] }) {
  const chooseStarter = useGameStore((store) => store.chooseStarter);

  const actions: DebugAction[] = starters.map((starter) => ({
    label: `${starter.name} (${starter.origin})`,
    run: () => chooseStarter(starter.id),
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
  const upgrades = useGameStore(selectUpgradeViews);
  const buyUpgrade = useGameStore((store) => store.buyUpgrade);

  const actions: DebugAction[] = upgrades.map((upgrade) => {
    const costText = upgrade.isMaxed ? 'nível máximo' : `${formatNumber(upgrade.cost)} Patacas`;

    return {
      label: `${upgrade.name}, nível ${upgrade.level}: ${costText}`,
      run: () => buyUpgrade(upgrade.id),
      disabled: !upgrade.canBuy,
    };
  });

  return <ActionButtons actions={actions} />;
}


// =============================================================================
// =============================================================================
// S E Ç Ã O :   C O N T R O L E S   D E   T E S T E

// Botões que mexem no jogo fora do ritmo normal
function TestControlsSection() {
  const combat = useGameStore(selectCombatView);
  const hitEnemy = useGameStore((store) => store.debugHitEnemy);
  const grantGold = useGameStore((store) => store.debugGrantGold);
  const setAutoProgress = useGameStore((store) => store.setAutoProgress);
  const challengeBoss = useGameStore((store) => store.challengeBoss);
  const grantAmulet = useGameStore((store) => store.debugGrantAmulet);
  const grantRoots = useGameStore((store) => store.debugGrantRoots);
  const rebrota = useGameStore((store) => store.rebrota);
  const resources = useGameStore(selectResourcesView);

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
      label: combat.autoProgress ? 'Desligar avanço automático' : 'Ligar avanço automático',
      run: () => setAutoProgress(!combat.autoProgress),
    },
    { label: 'Desafiar chefe', run: () => challengeBoss(), disabled: !combat.canChallengeBoss },
    { label: 'Ganhar um amuleto', run: grantAmulet },
    { label: '+10 Raízes', run: () => grantRoots(DEBUG_ROOTS_AMOUNT) },
    { label: 'Rebrotar', run: () => rebrota(), disabled: !resources.canRebrota },
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

// Estado e botões da seção de salvamento. As ações vêm da store.
function useSaveControls() {
  const saveNow = useGameStore((store) => store.saveNow);
  const exportSave = useGameStore((store) => store.exportSave);
  const importSave = useGameStore((store) => store.importSave);
  const hardReset = useGameStore((store) => store.hardReset);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const resetStep = useStepConfirmation(RESET_LABELS.length, RESET_TIMEOUT_MS);

  const handleExport = async (): Promise<void> => {
    const exportedCode = exportSave();
    setCode(exportedCode);
    const wasCopied = await copyToClipboard(exportedCode);
    setMessage(wasCopied ? SAVE_MESSAGES.copied : SAVE_MESSAGES.notCopied);
  };

  const handleImport = (): void => {
    if (code.trim() === '') {
      setMessage(SAVE_MESSAGES.emptyCode);
      return;
    }
    const result = importSave(code);
    setMessage(result.ok ? SAVE_MESSAGES.imported : result.error);
  };

  const handleReset = (): void => {
    if (resetStep.advance()) {
      hardReset();
      setCode('');
      setMessage(SAVE_MESSAGES.reset);
    }
  };

  const actions: DebugAction[] = [
    { label: 'Gravar agora', run: () => setMessage(describeSaveReceipt(saveNow())) },
    { label: 'Exportar', run: () => void handleExport() },
    { label: 'Importar', run: handleImport },
    { label: RESET_LABELS[resetStep.step] ?? '', run: handleReset, isDanger: true },
  ];

  return { code, setCode, message, actions };
}

// Texto que confirma a gravação, com o horário e o tamanho do que está no localStorage
function describeSaveReceipt(receipt: SaveReceipt): string {
  if (receipt.sizeInCharacters === null) {
    return SAVE_MESSAGES.notSaved;
  }

  const time = formatClockTime(receipt.savedAt);
  const size = receipt.sizeInCharacters;
  return `Gravado às ${time}. O salvamento tem ${size} caracteres no localStorage.`;
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
