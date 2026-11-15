/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/arena/ArenaPanel.tsx
 * O que faz: o painel central. Em cima fica a capa do folheto, com o inimigo
 * em campo. Embaixo ficam as barras de ataque da comitiva e o registro do
 * que acabou de acontecer.
 */

import { AttackBars } from './AttackBars';
import { EnemyCover } from './EnemyCover';
import { EventLog } from './EventLog';

// =============================================================================
// =============================================================================
// A R E N A

// Em tela larga a coluna tem a altura da janela. Se o conteúdo não couber, ela rola por dentro.
const PANEL_CLASS = 'flex min-h-0 flex-col gap-3 lg:overflow-y-auto';

interface ArenaPanelProps {
  className?: string; // posição do painel na grade da tela
}

// Capa com o inimigo, barras de ataque e registro
export function ArenaPanel({ className = '' }: ArenaPanelProps) {
  return (
    <section className={`${PANEL_CLASS} ${className}`} aria-label="Arena">
      <EnemyCover />
      <AttackBars />
      <EventLog />
    </section>
  );
}
