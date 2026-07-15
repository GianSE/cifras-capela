import { useSyncExternalStore } from 'react';
import { preferencesStorage, type UserPreferences } from '@/lib/storage/preferences';

/**
 * Assina as preferências do usuário e re-renderiza quando qualquer valor muda
 * (inclusive por outra aba). Fonte única de verdade para tema, favoritos,
 * histórico, fonte, sustenidos/bemóis e velocidade de auto-scroll.
 */
export function usePreferences(): UserPreferences {
  return useSyncExternalStore(
    preferencesStorage.subscribe,
    preferencesStorage.getSnapshot,
    preferencesStorage.getSnapshot,
  );
}
