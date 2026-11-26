/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/modals/ExpeditionReportModal.tsx
 * O que faz: a janela da volta de uma expedição. Abre sozinha quando a
 * store tem um relatório de expedição: diz como ela terminou, quanto durou e
 * o que a bolsa rendeu na clareira.
 *
 * Mapa:
 *   1. Janela
 *   2. Textos
 */

import { selectExpeditionReport } from '../../store/expeditionSelectors';
import type { ExpeditionReportView } from '../../store/expeditionSelectors';
import type { NamedAmount } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatDuration, formatNumber } from '../../utils/format';
import { Button } from '../ui/Button';
import { Modal } from './Modal';

// =============================================================================
// =============================================================================
// J A N E L A

const GAIN_ROW_CLASS = 'flex justify-between gap-4 border-b border-tinta/30 py-1';

interface Gain {
  label: string;
  value: string;
}

// Abre quando há relatório de expedição e fecha ao continuar
export function ExpeditionReportModal() {
  const report = useGameStore(selectExpeditionReport);
  const dismiss = useGameStore((store) => store.dismissExpeditionReport);

  if (report === null) {
    return null;
  }

  return (
    <Modal title={TITLES[report.outcome]} onClose={dismiss}>
      <p className="text-sm">{describeOutcome(report)}</p>
      <dl className="mt-3 border-t-2 border-tinta text-sm">
        {getGains(report).map((gain) => (
          <div key={gain.label} className={GAIN_ROW_CLASS}>
            <dt>{gain.label}</dt>
            <dd className="font-bold">{gain.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-end">
        <Button variant="solid" onClick={dismiss}>
          Voltar para a clareira
        </Button>
      </div>
    </Modal>
  );
}


// =============================================================================
// =============================================================================
// T E X T O S

// Título de cada jeito de terminar
const TITLES: Record<ExpeditionReportView['outcome'], string> = {
  concluida: 'Expedição completa',
  caiu: 'A comitiva te trouxe de volta',
  voltou: 'De volta à clareira',
  interrompida: 'Expedição interrompida',
};

// Uma frase sobre como terminou e quanto durou
function describeOutcome(report: ExpeditionReportView): string {
  const duration = formatDuration(report.seconds);
  const place = report.mapName;

  switch (report.outcome) {
    case 'concluida':
      return `Você aguentou ${duration} em ${place} e a bolsa veio com bônus.`;
    case 'caiu':
      return `Você caiu depois de ${duration} em ${place}, mas a bolsa veio inteira.`;
    case 'voltou':
      return `Você voltou de ${place} depois de ${duration}, com a bolsa inteira.`;
    case 'interrompida':
      return `O jogo fechou no meio da expedição em ${place}. A bolsa foi entregue mesmo assim.`;
  }
}

// Uma linha por tipo de ganho. Linhas zeradas ficam de fora.
function getGains(report: ExpeditionReportView): Gain[] {
  const gains: Gain[] = [
    { label: 'Visagens na bolsa', value: formatNumber(report.kills) },
  ];

  if (report.preparationName !== null) {
    gains.unshift({ label: 'Preparo', value: report.preparationName });
  }

  if (report.bonusKills > 0) {
    gains.push({ label: 'Visagens de bônus', value: `+${formatNumber(report.bonusKills)}` });
  }

  gains.push(
    { label: 'Patacas', value: `+${formatNumber(report.gold)}` },
    { label: 'XP para cada encantado da comitiva', value: `+${formatNumber(report.xp)}` },
  );

  if (report.amuletsFound > 0) {
    gains.push({ label: 'Amuletos encontrados', value: formatNumber(report.amuletsFound) });
  }

  return [
    ...gains,
    ...toGains(report.levelUps, 'Níveis de '),
    ...toGains(report.items, ''),
    ...toGains(report.trails, 'Rastros de '),
  ];
}

// Lista de nomes e quantidades -> linhas "+quantidade"
function toGains(amounts: readonly NamedAmount[], labelPrefix: string): Gain[] {
  return amounts.map((gain) => ({
    label: labelPrefix + gain.name,
    value: `+${formatNumber(gain.amount)}`,
  }));
}
