import { useEffect, useRef } from 'react';

/**
 * Mantém a tela acesa (Screen Wake Lock API) enquanto `enabled` for `true`.
 * Reaquire o lock ao voltar de segundo plano. Falha silenciosamente em
 * navegadores sem suporte.
 */
export function useWakeLock(enabled: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let released = false;

    const request = async () => {
      try {
        lockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        /* ignora — sem suporte ou negado */
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !released) {
        void request();
      }
    };

    void request();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void lockRef.current?.release().catch(() => undefined);
      lockRef.current = null;
    };
  }, [enabled]);
}
