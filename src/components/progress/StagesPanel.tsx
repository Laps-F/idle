/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/progress/StagesPanel.tsx
 * O que faz: a aba de estágios. Deixa voltar a estágios já liberados (para
 * juntar Oferendas), seguir até o mais alto, ligar ou desligar o avanço
 * automático e desafiar o chefe na mão. O que pode ou não ser clicado chega
 * decidido pelo seletor.
 */

import { ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

import { selectStageView } from '../../store/selectors';
import type { StageView } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { Button } from '../ui/Button';

// =============================================================================
// =============================================================================
// E S T Á G I O S

const ICON_SIZE = 16;

// Navegação entre estágios, avanço automático e desafio ao chefe
export function StagesPanel() {
  const stage = useGameStore(selectStageView);
  const goToStage = useGameStore((store) => store.goToStage);
  const setAutoProgress = useGameStore((store) => store.setAutoProgress);
  const challengeBoss = useGameStore((store) => store.challengeBoss);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-display text-lg leading-tight">{stage.zoneName}</p>
        <p>
          Estágio {stage.stage}. O mais alto liberado é o {stage.maxStage}.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button disabled={!stage.canGoBack} onClick={() => goToStage(stage.previousStage)}>
            <ChevronLeft size={ICON_SIZE} aria-hidden="true" />
            Anterior
          </Button>
          <Button disabled={!stage.canGoForward} onClick={() => goToStage(stage.nextStage)}>
            Próximo
            <ChevronRight size={ICON_SIZE} aria-hidden="true" />
          </Button>
          <Button disabled={!stage.canGoForward} onClick={() => goToStage(stage.maxStage)}>
            Mais alto
            <ChevronsRight size={ICON_SIZE} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-tinta"
          checked={stage.autoProgress}
          onChange={(event) => setAutoProgress(event.target.checked)}
        />
        <span>
          <span className="font-bold">Avanço automático</span>
          <br />
          Chama o chefe sozinho depois de {stage.killsToBoss} visagens e segue para o próximo
          estágio.
        </span>
      </label>

      <div>
        <Button
          variant="solid"
          className="w-full"
          disabled={!stage.canChallengeBoss}
          onClick={() => challengeBoss()}
        >
          Desafiar o chefe
        </Button>
        <p className="mt-1 text-xs">{describeBossStatus(stage)}</p>
      </div>
    </div>
  );
}

// Explica por que o botão do chefe está ligado ou desligado
function describeBossStatus(stage: StageView): string {
  if (stage.isBossFight) {
    return 'O chefe já está em campo.';
  }
  if (stage.canChallengeBoss) {
    return 'As visagens do estágio caíram. O chefe pode ser desafiado.';
  }

  return `Faltam ${stage.killsRemaining} visagens para o chefe aparecer.`;
}
