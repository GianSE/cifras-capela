import { useCallback } from 'react';
import { preferencesStorage } from '@/lib/storage/preferences';
import { usePreferences } from './usePreferences';

/** Quantas músicas contam como "recentes" (filtro da biblioteca e atalho das playlists). */
export const RECENT_LIMIT = 10;

/**
 * Histórico de músicas abertas recentemente (persistido em localStorage).
 */
export function useHistory() {
  const { recentSongs } = usePreferences();

  const record = useCallback((id: string) => preferencesStorage.addRecentSong(id), []);
  const clear = useCallback(() => preferencesStorage.clearRecents(), []);

  return { recentSongs, record, clear };
}
