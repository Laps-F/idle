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

import { writeToLocalStorage } from './saveManager';

// =============================================================================
// =============================================================================
// A B A   A T I V A

const ACTIVE_TAB_KEY = 'encantados-aba-ativa';

// Marca esta aba como a dona do jogo e chama "onTakenOver" se outra aba assumir.
// Devolve a função que para de escutar.
export function claimActiveTab(onTakenOver: () => void): () => void {
  const tabId = createTabId();

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

// Marca única desta aba: o instante em que abriu mais um trecho sorteado
function createTabId(): string {
  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now()}-${randomPart}`;
}
