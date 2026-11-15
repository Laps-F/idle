/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/ui/Tabs.tsx
 * O que faz: um painel com abas. Cada aba tem um título, um aviso opcional
 * com um número (quantas coisas pedem atenção ali) e o conteúdo.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

// =============================================================================
// =============================================================================
// A B A S

export interface TabDef {
  id: string;
  title: string;
  badge?: number; // quando maior que zero, aparece um aviso ao lado do título
  badgeLabel?: string; // o que o número conta, para leitores de tela
  content: ReactNode;
}

interface TabsProps {
  label: string; // o que este grupo de abas reúne, para leitores de tela
  tabs: TabDef[];
  className?: string; // posição do painel na grade da tela
}

const TAB_CLASS = 'flex items-center gap-1.5 border-2 border-b-0 border-tinta px-3 py-1.5 text-sm';
const ACTIVE_TAB_CLASS = `${TAB_CLASS} bg-jornal font-bold`;
const IDLE_TAB_CLASS = `${TAB_CLASS} bg-jornal-escuro font-semibold hover:bg-jornal`;

// Painel com abas. Só o conteúdo da aba aberta é desenhado.
export function Tabs({ label, tabs, className = '' }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <section className={`flex min-h-0 flex-col ${className}`} aria-label={label}>
      <div role="tablist" aria-label={label} className="flex gap-1 pl-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === activeTab?.id}
            aria-controls={`painel-${tab.id}`}
            className={tab.id === activeTab?.id ? ACTIVE_TAB_CLASS : IDLE_TAB_CLASS}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.title}
            <TabBadge count={tab.badge ?? 0} label={tab.badgeLabel ?? ''} />
          </button>
        ))}
      </div>
      {activeTab !== undefined && (
        <div
          role="tabpanel"
          id={`painel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
          className="-mt-0.5 min-h-0 flex-1 overflow-y-auto border-2 border-tinta bg-jornal p-3"
        >
          {activeTab.content}
        </div>
      )}
    </section>
  );
}

// Aviso com o número de coisas que pedem atenção na aba. Some quando é zero.
function TabBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className="min-w-5 bg-urucum px-1 text-center text-xs font-bold leading-5 text-jornal"
      aria-label={`${count} ${label}`}
    >
      {count}
    </span>
  );
}
