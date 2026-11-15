/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/modals/OfflineModal.tsx
 * O que faz: a janela de boas-vindas de volta. Abre sozinha quando a store
 * tem um relatório de ausência, o que acontece no primeiro tick depois de a
 * página abrir, se a comitiva rendeu algo enquanto o jogo estava fechado.
 * Mostra quanto tempo passou, quanto rendeu e o que foi ganho.
 *
 * Mapa:
 *   1. Janela
 *   2. Texto do tempo
 *   3. Lista de ganhos
 */

import { selectOfflineView } from '../../store/selectors';
import type { NamedAmount, OfflineView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatDuration, formatNumber, formatPercent } from '../../utils/format';
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

// Abre quando há relatório de ausência e fecha ao continuar
export function OfflineModal() {
  const offline = useGameStore(selectOfflineView);
  const dismissOfflineReport = useGameStore((store) => store.dismissOfflineReport);

  if (offline === null) {
    return null;
  }

  return (
    <Modal title="Que bom que você voltou" onClose={dismissOfflineReport}>
      <p className="text-sm">{describeAbsence(offline)}</p>
      <dl className="mt-3 border-t-2 border-tinta text-sm">
        {getGains(offline).map((gain) => (
          <div key={gain.label} className={GAIN_ROW_CLASS}>
            <dt>{gain.label}</dt>
            <dd className="font-bold">{gain.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-end">
        <Button variant="solid" onClick={dismissOfflineReport}>
          Continuar
        </Button>
      </div>
    </Modal>
  );
}


// =============================================================================
// =============================================================================
// T E X T O   D O   T E M P O

// Explica quanto tempo passou e quanto dele rendeu
function describeAbsence(offline: OfflineView): string {
  const away = formatDuration(offline.secondsAway);
  const simulated = formatDuration(offline.secondsSimulated);
  const efficiency = formatPercent(offline.efficiency);
  const capNote = offline.wasCapped
    ? ` Só as primeiras ${formatDuration(offline.capSeconds)} contam.`
    : '';

  return (
    `Você ficou ${away} fora. Sem você por perto a comitiva rende ${efficiency}, ` +
    `então ela lutou o equivalente a ${simulated}.${capNote}`
  );
}


// =============================================================================
// =============================================================================
// L I S T A   D E   G A N H O S

// Uma linha por tipo de ganho. Linhas zeradas ficam de fora.
function getGains(offline: OfflineView): Gain[] {
  const gains: Gain[] = [
    { label: 'Patacas', value: `+${formatNumber(offline.gold)}` },
    { label: 'XP para cada encantado da comitiva', value: `+${formatNumber(offline.xp)}` },
    { label: 'Visagens derrotadas', value: formatNumber(offline.kills) },
  ];

  if (offline.bossesDefeated > 0) {
    gains.push({ label: 'Chefes vencidos', value: formatNumber(offline.bossesDefeated) });
  }
  if (offline.stagesAdvanced > 0) {
    gains.push({ label: 'Estágios avançados', value: formatNumber(offline.stagesAdvanced) });
  }

  return [
    ...gains,
    ...toGains(offline.levelUps, 'Níveis de '),
    ...toGains(offline.items, ''),
    ...toGains(offline.trails, 'Rastros de '),
  ];
}

// Lista de nomes e quantidades -> linhas "+quantidade"
function toGains(amounts: readonly NamedAmount[], labelPrefix: string): Gain[] {
  return amounts.map((gain) => ({
    label: labelPrefix + gain.name,
    value: `+${formatNumber(gain.amount)}`,
  }));
}
