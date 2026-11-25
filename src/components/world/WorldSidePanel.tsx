/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/world/WorldSidePanel.tsx
 * O que faz: o painel ao lado do mapa. Mostra quem anda (nível e XP), quantas
 * visagens já caíram, como jogar e a legenda das imagens que ainda vão entrar.
 * Só formata o que recebe do seletor.
 */

import { selectWorldHud } from '../../store/selectors';
import { useGameStore } from '../../store/useGameStore';
import { formatNumber } from '../../utils/format';
import { Meter } from '../ui/Meter';
import { getPlayerSprite, listTileSprites, PORTAL_SPRITE } from './sprites';
import type { SpriteSlot } from './sprites';

// =============================================================================
// =============================================================================
// P A I N E L

const SECTION_CLASS = 'space-y-2 border-2 border-tinta bg-jornal p-3';
const TITLE_CLASS = 'font-display text-lg leading-none';

// Coluna ao lado do mapa, de cima para baixo: personagem, como jogar e legenda
export function WorldSidePanel() {
  return (
    <aside className="space-y-3">
      <LeadSection />
      <HowToPlaySection />
      <LegendSection />
    </aside>
  );
}

// Quem anda pelo mapa, o nível e o caminho até o próximo
function LeadSection() {
  const hud = useGameStore(selectWorldHud);
  const xpFraction = hud.leadXpToNextLevel > 0 ? hud.leadXp / hud.leadXpToNextLevel : 0;

  return (
    <section className={SECTION_CLASS} aria-label="Personagem">
      <h2 className={TITLE_CLASS}>{hud.leadName ?? 'Ninguém ainda'}</h2>
      {hud.leadName !== null && (
        <>
          <p className="text-sm">Nível {formatNumber(hud.leadLevel)}</p>
          <Meter fraction={xpFraction} label="Experiência até o próximo nível" />
        </>
      )}
      <p className="text-sm">
        {hud.mapName} (nível {hud.mapLevel})
      </p>
      <p className="text-sm">Visagens derrotadas: {formatNumber(hud.totalKills)}</p>
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
        <li>Chegue perto de uma visagem: o golpe sai sozinho quando a barra amarela enche.</li>
        <li>O bloco roxo é uma passagem para outro mapa.</li>
        <li>Com o jogo fechado, a personagem continua lutando no mapa onde ficou.</li>
      </ul>
      <p className="text-sm">
        A tela antiga, por estágios, continua em{' '}
        <a className="underline" href="?classico">
          ?classico
        </a>
        .
      </p>
    </section>
  );
}

// Cada bloco colorido e o arquivo de imagem que vai entrar no lugar dele
function LegendSection() {
  const slots: { name: string; slot: SpriteSlot }[] = [
    ...listTileSprites().map(({ tileId, slot }) => ({ name: tileId, slot })),
    { name: 'passagem', slot: PORTAL_SPRITE },
    { name: 'personagem', slot: getPlayerSprite(null) },
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
