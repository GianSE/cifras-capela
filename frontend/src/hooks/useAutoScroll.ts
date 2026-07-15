import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAutoScrollResult {
  readonly isScrolling: boolean;
  readonly speed: number;
  readonly setSpeed: (speed: number) => void;
  readonly toggle: () => void;
  readonly start: () => void;
  readonly stop: () => void;
}

/**
 * Rolagem automática suave de um contêiner, com velocidade ajustável.
 *
 * Usa `requestAnimationFrame` acumulando frações de pixel (para velocidades
 * baixas rolarem suavemente). Pausa automaticamente ao chegar ao fim.
 *
 * @param targetRef - Ref do elemento rolável (ou `null` para usar a janela).
 * @param initialSpeed - Velocidade inicial (px/segundo ≈ `speed * 30`).
 */
export function useAutoScroll(
  targetRef: React.RefObject<HTMLElement | null>,
  initialSpeed = 1,
): UseAutoScrollResult {
  const [isScrolling, setIsScrolling] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const remainderRef = useRef<number>(0);
  const speedRef = useRef<number>(initialSpeed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const stop = useCallback(() => {
    setIsScrolling(false);
  }, []);

  const getScroller = useCallback((): HTMLElement | Window => {
    return targetRef.current ?? window;
  }, [targetRef]);

  useEffect(() => {
    if (!isScrolling) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    lastTimeRef.current = performance.now();
    remainderRef.current = 0;

    const tick = (now: number) => {
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // ~30 px/s por unidade de velocidade.
      const pxPerMs = (speedRef.current * 30) / 1000;
      remainderRef.current += pxPerMs * dt;
      const pixels = Math.floor(remainderRef.current);

      if (pixels > 0) {
        remainderRef.current -= pixels;
        const scroller = getScroller();
        const el = targetRef.current;

        const atBottom = el
          ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
          : window.innerHeight + window.scrollY >= document.body.scrollHeight - 1;

        if (atBottom) {
          setIsScrolling(false);
          return;
        }
        scroller.scrollBy(0, pixels);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isScrolling, getScroller, targetRef]);

  const toggle = useCallback(() => setIsScrolling((prev) => !prev), []);
  const start = useCallback(() => setIsScrolling(true), []);

  return { isScrolling, speed, setSpeed, toggle, start, stop };
}
