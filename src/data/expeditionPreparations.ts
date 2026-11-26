/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/data/expeditionPreparations.ts
 * O que faz: os preparos que a pessoa pode fazer antes de partir em
 * expedição, pagando Oferendas. É o primeiro uso das Oferendas depois dos
 * pactos (decidido em 26/11/2026, Caminho 1).
 *
 * Como ler:
 *   - cost: Oferendas gastas ao partir. Não voltam, nem se a expedição acabar cedo.
 *   - modifiers: só o que muda. O que não aparece vale 1 (normal). Os nomes
 *     são os de RunModifiers (src/domain/types.ts) e quem aplica é a cena
 *     (src/domain/expeditionScene.ts). Todos são multiplicadores:
 *       playerSpeed      velocidade da personagem
 *       specialDamage    dano do golpe especial
 *       specialCooldown  recarga do golpe especial (0,5 = metade do tempo)
 *       spawnRate        ritmo das visagens novas (2 = chegam duas vezes mais rápido)
 *       maxEnemies       teto de visagens no mapa
 *       footprintRate    ritmo das pegadas (2 = surgem duas vezes mais rápido)
 *       damageTaken      dano de cada encostada
 *   - Uma expedição usa no máximo um preparo.
 *
 * Para criar um preparo novo, basta acrescentar uma entrada aqui. A aba
 * "Expedições" mostra sozinha, e tests/data.test.ts confere ids, Oferendas e
 * números.
 */

import type { ExpeditionPreparationDef } from '../domain/types';

// =============================================================================
// =============================================================================
// P R E P A R O S

export const EXPEDITION_PREPARATIONS: ExpeditionPreparationDef[] = [
  {
    id: 'favo-no-toco',
    name: 'Favo no toco',
    description: 'O cheiro do mel atrai mais visagens: a bolsa enche mais, e o perigo também.',
    cost: { 'mel-silvestre': 3 },
    modifiers: { spawnRate: 1.5, maxEnemies: 1.5 },
  },
  {
    id: 'trilha-de-cipo',
    name: 'Trilha de cipó',
    description: 'Cipó trançado amarrado nas árvores: as pegadas aparecem duas vezes mais.',
    cost: { 'cipo-trancado': 3 },
    modifiers: { footprintRate: 2 },
  },
  {
    id: 'brasa-no-bornal',
    name: 'Brasa no bornal',
    description: 'Uma brasa viva guardada: o golpe especial bate o dobro e recarrega mais rápido.',
    cost: { 'brasa-viva': 1 },
    modifiers: { specialDamage: 2, specialCooldown: 2 / 3 },
  },
];
