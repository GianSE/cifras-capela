import { useCallback } from 'react';
import { preferencesStorage } from '@/lib/storage/preferences';
import { usePreferences } from './usePreferences';

/**
 * Favoritos (persistidos em localStorage). Reativo entre componentes e abas.
 */
export function useFavorites() {
  const { favorites } = usePreferences();

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);
  const toggle = useCallback((id: string) => preferencesStorage.toggleFavorite(id), []);

  return { favorites, isFavorite, toggle };
}
