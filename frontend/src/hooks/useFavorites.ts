import { useCallback, useMemo } from 'react';
import { preferencesStorage } from '@/lib/storage/preferences';
import { usePreferences } from './usePreferences';

/**
 * Músicas favoritas — as que a pessoa toca com frequência (persistidas neste
 * aparelho, como o histórico e os tons).
 */
export function useFavorites() {
  const { favorites } = usePreferences();

  // `Set` para a lista não ficar O(n²) ao marcar a estrela de cada linha.
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);
  const toggle = useCallback((id: string) => preferencesStorage.toggleFavorite(id), []);
  const clear = useCallback(() => preferencesStorage.clearFavorites(), []);

  return { favorites, favoriteIds, isFavorite, toggle, clear };
}
