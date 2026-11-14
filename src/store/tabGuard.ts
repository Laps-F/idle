/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/store/tabGuard.ts
 * O que faz: garante que só uma aba cuida do jogo. Duas abas abertas simulam
 * e gravam cada uma o seu estado, e a última a gravar apaga o progresso da
 * outra. A regra é: a aba mais nova manda.
 *
 * Como funciona: cada aba escreve a sua marca numa chave do localStorage.
 * O navegador avisa as outras abas dessa escrita pelo evento "storage".
 */

import { createUniqueId } from '../utils/id';
import { writeToLocalStorage } from './saveManager';

// =============================================================================
// =============================================================================
// A B A   A T I V A

const ACTIVE_TAB_KEY = 'encantados-aba-ativa';

/**
 * Marca esta aba como a dona do jogo e avisa quando outra aba assumir.
 *
 * @param onTakenOver Chamada quando outra aba escreve a própria marca.
 * @returns Função que para de escutar. Chame ao desligar o laço do jogo.
 *
 * Casos de borda: o evento "storage" só chega nas OUTRAS abas, então a aba não
 * reage à própria marca. Sem localStorage, a marca não é gravada e nenhuma aba
 * é avisada: as abas voltam a concorrer, mas o jogo continua funcionando.
 */
export function claimActiveTab(onTakenOver: () => void): () => void {
  const tabId = createUniqueId(Date.now(), Math.random);

  const handleStorage = (event: StorageEvent): void => {
    const wasTakenOver = event.key === ACTIVE_TAB_KEY && event.newValue !== tabId;

    if (wasTakenOver) {
      onTakenOver();
    }
  };

  writeToLocalStorage(ACTIVE_TAB_KEY, tabId);
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
