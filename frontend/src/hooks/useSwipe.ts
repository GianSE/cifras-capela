import { useRef } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/** Distância mínima na horizontal para valer como swipe (px). */
const THRESHOLD = 70;
/** O movimento horizontal precisa dominar o vertical (senão é rolagem). */
const DOMINANCE = 1.3;
/** Gesto lento demais não conta (provavelmente é rolagem/hesitação). */
const MAX_DURATION = 800;

/**
 * Swipe horizontal por toque. Não chama `preventDefault`, então a rolagem
 * vertical continua funcionando normalmente — só reagimos no fim do gesto,
 * quando dá pra ver que foi um arrasto lateral (e não vertical).
 */
export function useSwipe({ onSwipeLeft, onSwipeRight }: SwipeHandlers) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      start.current = null;
      return;
    }
    const t = e.touches[0]!;
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;

    const t = e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Date.now() - s.t > MAX_DURATION) return;
    if (Math.abs(dx) < THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return; // gesto mais vertical

    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  };

  return { onTouchStart, onTouchEnd };
}
