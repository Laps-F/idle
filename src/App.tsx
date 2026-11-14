/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/App.tsx
 * O que faz: tela provisória de conferência. Liga o laço do jogo e mostra os
 * números crus da store, para testar o motor antes de existir a interface.
 * Será trocada pelo painel completo na etapa de interface.
 *
 * Mapa:
 *   1. Tela principal
 *   2. Escolha do encantado inicial
 *   3. Painel de conferência
 */

import { useEffect } from 'react';

import { ENCANTADOS, UPGRADES, getEncantado, getEnemy, getZoneForStage } from './data';
import { getUpgradeCost } from './engine/formulas';
import { startGameLoop } from './store/gameLoop';
import { useGameStore } from './store/useGameStore';

// =============================================================================
// =============================================================================
// T E L A   P R I N C I P A L

const PAGE_STYLE = { maxWidth: 640, margin: '0 auto', padding: 24 };
const ROW_STYLE = { display: 'flex', gap: 8, flexWrap: 'wrap' as const, margin: '12px 0' };

// Liga o laço do jogo e escolhe o que mostrar
export default function App() {
  const hasStarter = useGameStore((store) => store.party.length > 0);

  useEffect(() => startGameLoop(), []);

  return (
    <main style={PAGE_STYLE}>
      <h1>Encantados</h1>
      <p>Tela provisória para conferir o motor.</p>
      {hasStarter ? <DebugPanel /> : <StarterChoice />}
    </main>
  );
}


// =============================================================================
// =============================================================================
// E S C O L H A   D O   E N C A N T A D O   I N I C I A L

// Um botão por encantado inicial
function StarterChoice() {
  const chooseStarter = useGameStore((store) => store.chooseStarter);
  const starters = ENCANTADOS.filter((encantado) => encantado.isStarter);

  return (
    <section>
      <h2>Quem começa com você?</h2>
      <div style={ROW_STYLE}>
        {starters.map((encantado) => (
          <button key={encantado.id} onClick={() => chooseStarter(encantado.id)}>
            {encantado.name} ({encantado.origin})
          </button>
        ))}
      </div>
    </section>
  );
}


// =============================================================================
// =============================================================================
// P A I N E L   D E   C O N F E R Ê N C I A

// Números principais do combate, comitiva e melhorias
function DebugPanel() {
  const gold = useGameStore((store) => store.gold);
  const stage = useGameStore((store) => store.stage);
  const killsInStage = useGameStore((store) => store.killsInStage);
  const combat = useGameStore((store) => store.combat);
  const zone = getZoneForStage(stage);
  const enemyName = getEnemy(combat.enemyId).name;

  return (
    <section>
      <h2>
        {zone.name}, estágio {stage}
      </h2>
      <p>
        {enemyName}: {Math.ceil(combat.enemyHp)} de {combat.enemyMaxHp} de vida
        {combat.isBoss ? ` (chefe, ${combat.bossTimeLeft.toFixed(1)} s)` : ''}
      </p>
      <p>
        Visagens no estágio: {killsInStage} de {zone.killsToBoss}. Patacas: {Math.floor(gold)}.
      </p>
      <PartyList />
      <UpgradeButtons />
    </section>
  );
}

// Nível de cada encantado da comitiva
function PartyList() {
  const party = useGameStore((store) => store.party);
  const roster = useGameStore((store) => store.roster);

  return (
    <ul>
      {party.map((encantadoId) => (
        <li key={encantadoId}>
          {getEncantado(encantadoId).name}, nível {roster[encantadoId].level}
        </li>
      ))}
    </ul>
  );
}

// Um botão de compra por melhoria
function UpgradeButtons() {
  const gold = useGameStore((store) => store.gold);
  const upgradeLevels = useGameStore((store) => store.upgrades);
  const buyUpgrade = useGameStore((store) => store.buyUpgrade);

  return (
    <div style={ROW_STYLE}>
      {UPGRADES.map((upgrade) => {
        const level = upgradeLevels[upgrade.id] ?? 0;
        const cost = getUpgradeCost(upgrade, level);

        return (
          <button key={upgrade.id} disabled={gold < cost} onClick={() => buyUpgrade(upgrade.id)}>
            {upgrade.name} (nível {level}): {cost} Patacas
          </button>
        );
      })}
    </div>
  );
}
