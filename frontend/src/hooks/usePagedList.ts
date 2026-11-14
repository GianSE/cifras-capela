import { useEffect, useState } from 'react';

const PAGE_SIZE = 50;

/**
 * Mostra a lista em páginas de 50, crescendo conforme o usuário rola — sem
 * isso, uma biblioteca de milhares de músicas trava o navegador renderizando
 * tudo de uma vez. Volta para a primeira página sempre que a lista muda (nova
 * busca, novo filtro): a página 6 de uma busca não faz sentido na próxima.
 */
export function usePagedList<T>(items: readonly T[]): {
  visible: readonly T[];
  hasMore: boolean;
  loadMore: () => void;
} {
  const [count, setCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setCount(PAGE_SIZE);
  }, [items]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    loadMore: () => setCount((c) => c + PAGE_SIZE),
  };
}
