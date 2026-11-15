/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/arena/EnemyCover.tsx
 * O que faz: a capa do folheto, que é a arena do jogo. Mostra a zona e o
 * estágio como título, a xilogravura do inimigo, o nome dele, a vida, o tempo
 * do chefe e quantas visagens faltam para o chefe.
 *
 * Cada parte lê da store só o que mostra. A figura só redesenha quando entra
 * outro inimigo. A vida redesenha a cada golpe. O tranco do golpe e os
 * números que sobem não redesenham nada: mexem direto no elemento.
 *
 * Mapa:
 *   1. Capa
 *   2. Inimigo em campo (figura e nome)
 *   3. Vida e tempo do chefe
 *   4. Caminho até o chefe
 */

import { useRef } from 'react';

import {
  readBossTimeFraction,
  selectBossSecondsLeft,
  selectEnemyHealth,
  selectEnemyIdentity,
  selectEnemySpawnKey,
  selectStageView,
} from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatNumber } from '../../utils/format';
import { useCombatFeed } from '../hooks/useCombatFeed';
import { Figure } from '../ui/Figure';
import { LiveMeter, Meter } from '../ui/Meter';
import { FloatingTextLayer } from './FloatingTextLayer';

// =============================================================================
// =============================================================================
// C A P A

const HIT_SHAKE_CLASS = 'hit-shake';

// A figura encolhe em telas baixas, para a capa, as barras e o registro caberem sem rolar
const FIGURE_BOX_CLASS = 'mx-auto mt-2 w-40 lg:w-[min(12rem,22dvh)]';

// O espaço do tempo do chefe fica reservado, para a capa não mudar de altura quando ele entra
const BOSS_TIMER_BOX_CLASS = 'mx-auto mt-2 min-h-10 max-w-sm';

// Capa do folheto: papel colorido do bioma, moldura de tinta e o inimigo no meio
export function EnemyCover() {
  const stage = useGameStore(selectStageView);
  const spawnKey = useGameStore(selectEnemySpawnKey);

  return (
    <div className="relative border-4 border-tinta bg-[var(--capa)] px-4 pb-4 pt-3 text-center">
      <p className="font-display text-xl leading-tight sm:text-2xl">{stage.zoneName}</p>
      <p className="text-sm font-semibold">Estágio {stage.stage}</p>

      {/* A chave muda a cada inimigo novo: a figura repete a entrada de carimbo e a barra
          de vida nasce cheia, em vez de deslizar a partir da vida do inimigo anterior */}
      <EnemyBlock key={spawnKey} />
      <BossTimer />
      <BossTrack killsInStage={stage.killsInStage} killsToBoss={stage.killsToBoss} />

      <FloatingTextLayer />
    </div>
  );
}


// =============================================================================
// =============================================================================
// I N I M I G O   E M   C A M P O

// Tudo que pertence ao inimigo em campo: figura, nome e vida
function EnemyBlock() {
  return (
    <>
      <EnemyFigure />
      <EnemyHealth />
    </>
  );
}

// Xilogravura e nome do inimigo. Leva um tranco a cada golpe, sem redesenhar.
function EnemyFigure() {
  const enemy = useGameStore(selectEnemyIdentity);
  const shakeRef = useRef<HTMLDivElement | null>(null);

  useCombatFeed((feed) => {
    if (feed.hits.length > 0) {
      restartAnimation(shakeRef.current, HIT_SHAKE_CLASS);
    }
  });

  return (
    <>
      <div ref={shakeRef} className={FIGURE_BOX_CLASS}>
        <Figure
          figureId={enemy.enemyId}
          label={enemy.name}
          paper="var(--capa)"
          className="stamp-in h-auto w-full"
        />
      </div>
      <h2 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">{enemy.name}</h2>
      <p className="min-h-5 text-sm font-bold text-urucum">
        {enemy.isBoss ? 'Chefe do estágio' : ''}
      </p>
    </>
  );
}

// Tira e recoloca a classe, para a animação de CSS começar de novo
function restartAnimation(element: HTMLElement | null, className: string): void {
  if (element === null) {
    return;
  }

  element.classList.remove(className);
  // Ler a largura obriga o navegador a notar que a classe saiu antes de ela voltar
  void element.offsetWidth;
  element.classList.add(className);
}


// =============================================================================
// =============================================================================
// V I D A   E   T E M P O   D O   C H E F E

// Barra de vida e os números por extenso
function EnemyHealth() {
  const health = useGameStore(selectEnemyHealth);
  const current = formatNumber(Math.ceil(health.hp));

  return (
    <div className="mx-auto mt-2 max-w-sm">
      <Meter fraction={health.hpFraction} label="Vida do inimigo" tone="urucum" className="h-4" />
      <p className="mt-1 text-sm font-semibold">
        Vida: {current} de {formatNumber(health.maxHp)}
      </p>
    </div>
  );
}

// Tempo que resta para vencer o chefe. Fora da luta contra o chefe, só guarda o espaço.
function BossTimer() {
  const secondsLeft = useGameStore(selectBossSecondsLeft);

  if (secondsLeft <= 0) {
    return <div className={BOSS_TIMER_BOX_CLASS} />;
  }

  return (
    <div className={BOSS_TIMER_BOX_CLASS}>
      <LiveMeter read={readBossTimeFraction} label="Tempo do chefe" className="h-2" />
      <p className="mt-1 text-sm font-semibold">Faltam {secondsLeft} s para o chefe escapar</p>
    </div>
  );
}


// =============================================================================
// =============================================================================
// C A M I N H O   A T É   O   C H E F E

const DONE_MARK_CLASS = 'h-2.5 w-2.5 border-2 border-tinta bg-tinta';
const PENDING_MARK_CLASS = 'h-2.5 w-2.5 border-2 border-tinta bg-transparent';

interface BossTrackProps {
  killsInStage: number;
  killsToBoss: number;
}

// Uma marca por visagem que falta derrotar antes do chefe
function BossTrack({ killsInStage, killsToBoss }: BossTrackProps) {
  const marks = Array.from({ length: killsToBoss }, (_, index) => index < killsInStage);

  return (
    <div className="mt-3">
      <div className="flex justify-center gap-1" aria-hidden="true">
        {marks.map((isDone, index) => (
          <span key={index} className={isDone ? DONE_MARK_CLASS : PENDING_MARK_CLASS} />
        ))}
      </div>
      <p className="mt-1 text-xs font-semibold">
        {killsInStage} de {killsToBoss} visagens até o chefe
      </p>
    </div>
  );
}
