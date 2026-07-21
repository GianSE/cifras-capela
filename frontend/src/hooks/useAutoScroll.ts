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

  /** Conteúdo rolável (1º filho do contêiner) — recebe o offset sub-pixel. */
  const getContent = useCallback((): HTMLElement | null => {
    return (targetRef.current?.firstElementChild as HTMLElement | null) ?? null;
  }, [targetRef]);

  useEffect(() => {
    if (!isScrolling) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const content = getContent();
      if (content) content.style.transform = '';
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

      const scroller = getScroller();
      const el = targetRef.current;
      const content = getContent();

      // Parte inteira: rola de verdade (scroll nativo).
      const whole = Math.floor(remainderRef.current);
      if (whole > 0) {
        remainderRef.current -= whole;

        const atBottom = el
          ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
          : window.innerHeight + window.scrollY >= document.body.scrollHeight - 1;

        if (atBottom) {
          if (content) content.style.transform = '';
          setIsScrolling(false);
          return;
        }
        scroller.scrollBy(0, whole);
      }

      // Resto fracionário (0–1px): desloca o conteúdo suavemente entre os passos
      // inteiros, dando movimento contínuo mesmo em velocidades bem baixas.
      if (content) {
        content.style.transform = `translate3d(0, ${-remainderRef.current}px, 0)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const content = getContent();
      if (content) content.style.transform = '';
    };
  }, [isScrolling, getScroller, getContent, targetRef]);

  const toggle = useCallback(() => setIsScrolling((prev) => !prev), []);
  const start = useCallback(() => setIsScrolling(true), []);

  return { isScrolling, speed, setSpeed, toggle, start, stop };
}
