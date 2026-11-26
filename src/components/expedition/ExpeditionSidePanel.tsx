/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/expedition/ExpeditionSidePanel.tsx
 * O que faz: o painel ao lado do mapa durante a expedição. Mostra quem saiu
 * e quanto já está na bolsa, o botão de voltar agora, os controles e a
 * legenda das imagens que ainda vão entrar. Só formata o que recebe.
 * Vida, tempo e golpe especial ficam no próprio mapa (mapRenderer.ts).
 */

import { selectExpeditionHud } from '../../store/expeditionSelectors';
import { useGameStore } from '../../store/useGameStore';
import { formatNumber } from '../../utils/format';
import { Button } from '../ui/Button';
import {
  EXIT_SPRITE,
  getPlayerSprite,
  listTileSprites,
  PROJECTILE_SPRITE,
  SPECIAL_PROJECTILE_SPRITE,
} from './sprites';
import type { SpriteSlot } from './sprites';

// =============================================================================
// =============================================================================
// P A I N E L

const SECTION_CLASS = 'space-y-2 border-2 border-tinta bg-jornal p-3';
const TITLE_CLASS = 'font-display text-lg leading-none';

// Coluna ao lado do mapa, de cima para baixo: expedição, como jogar e legenda
export function ExpeditionSidePanel() {
  return (
    <aside className="space-y-3">
      <ExpeditionSection />
      <HowToPlaySection />
      <LegendSection />
    </aside>
  );
}

// Quem saiu, para onde, quanto está na bolsa e o botão de voltar
function ExpeditionSection() {
  const hud = useGameStore(selectExpeditionHud);
  const leaveExpedition = useGameStore((store) => store.leaveExpedition);

  if (hud === null) {
    return null;
  }

  return (
    <section className={SECTION_CLASS} aria-label="Expedição">
      <h2 className={TITLE_CLASS}>{hud.mapName}</h2>
      <p className="text-sm">Quem saiu: {hud.leaderName}</p>
      <p className="text-sm">Visagens na bolsa: {formatNumber(hud.lootCount)}</p>
      <Button variant="outline" onClick={leaveExpedition}>
        Voltar para a clareira agora
      </Button>
    </section>
  );
}

// Os controles do protótipo
function HowToPlaySection() {
  return (
    <section className={SECTION_CLASS} aria-label="Como jogar">
      <h2 className={TITLE_CLASS}>Como jogar</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Ande com as setas ou com W, A, S e D.</li>
        <li>O projétil comum sai sozinho na visagem mais perto, dentro do círculo.</li>
        <li>
          Espaço solta o projétil especial para o lado em que você anda. Ele atravessa as
          visagens e precisa recarregar.
        </li>
        <li>As visagens perseguem e batem ao encostar. Fuja, elas são mais lentas.</li>
        <li>O bloco roxo leva de volta para a clareira, com a bolsa inteira.</li>
        <li>Aguentando até o fim do tempo, a bolsa rende mais.</li>
        <li>
          P pausa. A expedição também pausa sozinha ao trocar de aba ou de janela. Qualquer tecla
          ou um clique no mapa continua.
        </li>
      </ul>
    </section>
  );
}

// Cada bloco colorido e o arquivo de imagem que vai entrar no lugar dele
function LegendSection() {
  const slots: { name: string; slot: SpriteSlot }[] = [
    ...listTileSprites().map(({ tileId, slot }) => ({ name: tileId, slot })),
    { name: 'passagem', slot: EXIT_SPRITE },
    { name: 'personagem', slot: getPlayerSprite(null) },
    { name: 'projétil', slot: PROJECTILE_SPRITE },
    { name: 'projétil especial', slot: SPECIAL_PROJECTILE_SPRITE },
  ];

  return (
    <section className={SECTION_CLASS} aria-label="Imagens que faltam">
      <h2 className={TITLE_CLASS}>Imagens que faltam</h2>
      <ul className="space-y-1 text-sm">
        {slots.map(({ name, slot }) => (
          <li key={name} className="flex items-center gap-2">
            <span
              className="inline-block size-4 border border-tinta"
              style={{ backgroundColor: slot.color }}
              aria-hidden="true"
            />
            <span>
              {name}: <code>{slot.file}</code>
            </span>
          </li>
        ))}
        <li>Cada encantado e cada visagem: o id dela, como saci.png.</li>
      </ul>
    </section>
  );
}
