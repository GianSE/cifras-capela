import { useCallback, useState } from 'react';

const KEY = 'cifras-capela:guest';

/**
 * Modo convidado: a pessoa escolheu usar o app só para ver (sem entrar). A
 * escolha fica salva, então a tela de boas-vindas não incomoda a cada abertura.
 * Entrar de verdade (Supabase) é o que libera criar/editar.
 */
export function useGuestMode() {
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  const enterAsGuest = useCallback(() => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* localStorage indisponível — segue em memória */
    }
    setIsGuest(true);
  }, []);

  /** Encerra o modo convidado (volta para a tela de boas-vindas). */
  const clearGuest = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* localStorage indisponível */
    }
    setIsGuest(false);
  }, []);

  return { isGuest, enterAsGuest, clearGuest };
}
