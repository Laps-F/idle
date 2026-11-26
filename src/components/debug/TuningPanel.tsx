/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/debug/TuningPanel.tsx
 * O que faz: o painel "Ajustes", para testar dificuldade e ritmo sem mexer no
 * código. Lista todos os números de balanceamento (src/store/tuning.ts) em
 * grupos, com busca, e troca o valor na hora. Também tem atalhos de teste
 * (nível de quem sai em expedição e Patacas) e a lista das mudanças para
 * copiar e tornar permanente no código.
 *
 * O botão "Ajustes" fica no cabeçalho da clareira e da expedição. A janela
 * fecha pelo botão "Fechar" ou pela tecla Esc. Para tirar
 * o botão do jogo, troque SHOW_TUNING_BUTTON para false.
 *
 * Mapa:
 *   1. Botão
 *   2. Janela
 *   3. Atalhos
 *   4. Campos
 */

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { selectTuningChangeCount, selectTuningView } from '../../store/selectors';
import type { TuningGroupView } from '../../store/selectors';
import type { TuningFieldView } from '../../store/tuning';
import { useGameStore } from '../../store/useGameStore';
import { Modal } from '../modals/Modal';
import { Button } from '../ui/Button';

// =============================================================================
// =============================================================================
// B O T Ã O

// Mostra o botão "Ajustes" no cabeçalho. Troque para false para esconder dos jogadores.
export const SHOW_TUNING_BUTTON = true;

const ICON_SIZE = 16;
const GRANT_GOLD_AMOUNT = 1000;

// Botão do cabeçalho, com o número de ajustes ligados, e a janela que ele abre
export function TuningButton() {
  const changeCount = useGameStore(selectTuningChangeCount);
  const [isOpen, setIsOpen] = useState(false);

  if (!SHOW_TUNING_BUTTON) {
    return null;
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <SlidersHorizontal size={ICON_SIZE} aria-hidden="true" />
        {changeCount > 0 ? `Ajustes (${changeCount})` : 'Ajustes'}
      </Button>
      {isOpen && <TuningPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}


// =============================================================================
// =============================================================================
// J A N E L A

interface TuningPanelProps {
  onClose: () => void;
}

// Janela com os atalhos, a busca, os grupos de campos e as mudanças
export function TuningPanel({ onClose }: TuningPanelProps) {
  const view = useGameStore(selectTuningView);
  const resetTuning = useGameStore((store) => store.resetTuning);
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const groups = term === '' ? view.groups : filterGroups(view.groups, term);

  return (
    <Modal title="Ajustes de teste" onClose={onClose} width="wide">
      <p className="text-sm">
        Os números mudam na hora e ficam guardados neste navegador até você desfazer. Valem para
        o que vier depois: visagens que nascem, próximo golpe, próxima expedição.
      </p>

      <ShortcutsSection />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar (ex.: vida, dano, chance)"
          aria-label="Buscar ajuste"
          className="min-w-0 flex-1 border-2 border-tinta bg-jornal px-2 py-1 text-sm"
        />
        <Button disabled={view.changeCount === 0} onClick={() => resetTuning(null)}>
          Desfazer tudo ({view.changeCount})
        </Button>
        <Button variant="solid" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {groups.map((group) => (
          <TuningGroup key={group.name} group={group} isOpen={term !== ''} />
        ))}
        {groups.length === 0 && <p className="text-sm">Nenhum ajuste com esse nome.</p>}
      </div>

      {view.changeCount > 0 && <ChangesSection text={view.changesText} />}

      <div className="mt-4 flex justify-end">
        <Button variant="solid" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}

// Grupos só com os campos cujo nome tem o termo buscado
function filterGroups(groups: readonly TuningGroupView[], term: string): TuningGroupView[] {
  return groups
    .map((group) => ({
      name: group.name,
      fields: group.fields.filter((field) =>
        `${group.name} ${field.label}`.toLowerCase().includes(term),
      ),
    }))
    .filter((group) => group.fields.length > 0);
}

// Lista das mudanças, para copiar e passar para o código
function ChangesSection({ text }: { text: string }) {
  return (
    <section className="mt-3 space-y-1" aria-label="Mudanças ligadas">
      <h3 className="font-bold text-sm">Mudanças ligadas (arquivo: código → teste)</h3>
      <textarea
        readOnly
        value={text}
        rows={Math.min(6, text.split('\n').length)}
        className="w-full border-2 border-tinta bg-jornal p-2 font-mono text-xs"
        aria-label="Lista das mudanças"
      />
      <Button size="small" onClick={() => void navigator.clipboard?.writeText(text)}>
        Copiar mudanças
      </Button>
    </section>
  );
}


// =============================================================================
// =============================================================================
// A T A L H O S

const SHORTCUTS_CLASS = 'mt-3 flex flex-wrap items-end gap-3 border-2 border-tinta p-2';

// Nível de quem sai em expedição e Patacas extras
function ShortcutsSection() {
  const leaderLevel = useGameStore((store) => {
    const leaderId = store.party[0];
    return leaderId === undefined ? null : (store.roster[leaderId]?.level ?? null);
  });
  const setLeaderLevel = useGameStore((store) => store.debugSetLeaderLevel);
  const grantGold = useGameStore((store) => store.debugGrantGold);

  return (
    <section className={SHORTCUTS_CLASS} aria-label="Atalhos">
      {leaderLevel !== null && (
        <label className="flex flex-col text-sm">
          Nível do primeiro da comitiva
          <NumberInput
            key={leaderLevel}
            value={leaderLevel}
            step={1}
            min={1}
            label="Nível do primeiro da comitiva"
            onCommit={(value) => setLeaderLevel(value)}
          />
        </label>
      )}
      <Button size="small" onClick={() => grantGold(GRANT_GOLD_AMOUNT)}>
        +{GRANT_GOLD_AMOUNT} Patacas
      </Button>
    </section>
  );
}


// =============================================================================
// =============================================================================
// C A M P O S

// Um grupo que abre e fecha. Abre sozinho quando tem mudança ou durante a busca.
function TuningGroup({ group, isOpen }: { group: TuningGroupView; isOpen: boolean }) {
  const changed = group.fields.filter((field) => field.isChanged).length;

  return (
    <details open={isOpen || changed > 0} className="border-2 border-tinta bg-jornal">
      <summary className="cursor-pointer px-2 py-1 font-bold text-sm">
        {group.name}
        {changed > 0 && ` (${changed} mudado${changed > 1 ? 's' : ''})`}
      </summary>
      <ul className="divide-y divide-tinta/20 px-2 pb-2">
        {group.fields.map((field) => (
          <TuningRow key={field.id} field={field} />
        ))}
      </ul>
    </details>
  );
}

// Uma linha: nome, valor e, se mudou, o valor do código e o botão de voltar
function TuningRow({ field }: { field: TuningFieldView }) {
  const setTuning = useGameStore((store) => store.setTuning);
  const resetTuning = useGameStore((store) => store.resetTuning);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
      <span className={field.isChanged ? 'font-bold' : ''} title={field.source}>
        {field.label}
      </span>
      <span className="flex items-center gap-2">
        {field.isChanged && <span className="text-xs">código: {field.defaultValue}</span>}
        <NumberInput
          key={`${field.id}-${field.value}`}
          value={field.value}
          step={field.step}
          min={field.min}
          label={field.label}
          onCommit={(value) => setTuning(field.id, value)}
        />
        {field.isChanged && (
          <Button size="small" onClick={() => resetTuning(field.id)}>
            Voltar
          </Button>
        )}
      </span>
    </li>
  );
}

interface NumberInputProps {
  value: number;
  step: number;
  min: number;
  label: string;
  onCommit: (value: number) => void;
}

// Caixa de número que só aplica ao sair dela ou ao apertar Enter (digitar "0," não quebra nada)
function NumberInput({ value, step, min, label, onCommit }: NumberInputProps) {
  const commit = (text: string): void => {
    const parsed = Number(text.replace(',', '.'));

    if (text.trim() !== '' && Number.isFinite(parsed) && parsed !== value) {
      onCommit(parsed);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      defaultValue={value}
      step={step}
      min={min}
      aria-label={label}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={handleKeyDown}
      className="w-28 border-2 border-tinta bg-jornal px-2 py-0.5 text-right text-sm"
    />
  );
}
