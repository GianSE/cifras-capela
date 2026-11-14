import { useEffect, useRef } from 'react';

/**
 * Elemento invisível que, ao entrar na tela (rolagem), carrega a próxima
 * página — o "scroll infinito". Fica no fim da lista; some quando não há
 * mais o que carregar.
 */
export function InfiniteScrollSentinel({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && onVisible(),
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  return <div ref={ref} aria-hidden className="h-1" />;
}
