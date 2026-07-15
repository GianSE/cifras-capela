import { useMemo } from 'react';
import { useSongLibrary } from './useSongLibrary';
import { searchEngine } from '@/lib/search/search-engine';
import type { SongIndexEntry } from '@/types/library';

export interface LibraryFilter {
  /** Texto de busca (nome, artista, categoria, tag, trechos da letra). */
  query?: string;
  /** Categorias ativas (interseção com as categorias da música). */
  categories?: readonly string[];
  /** Restringe a um conjunto de IDs (ex.: favoritos, histórico). */
  ids?: readonly string[];
}

/** Ordena por título com colação pt-BR. */
function byTitle(a: SongIndexEntry, b: SongIndexEntry): number {
  return a.title.localeCompare(b.title, 'pt-BR');
}

/**
 * Biblioteca de músicas com filtragem combinada (busca + categorias + ids).
 * A busca textual usa o MiniSearch; os demais filtros são aplicados por cima.
 */
export function useLibrary(filter: LibraryFilter = {}) {
  const { songs, isLoading, error } = useSongLibrary();
  const { query = '', categories = [], ids } = filter;

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const song of songs) {
      for (const c of song.categories ?? []) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [songs]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    let list = trimmed ? searchEngine.search(trimmed) : [...songs].sort(byTitle);

    if (categories.length > 0) {
      list = list.filter((song) =>
        categories.every((c) => (song.categories ?? []).includes(c)),
      );
    }

    if (ids) {
      const allow = new Set(ids);
      list = list.filter((song) => allow.has(song.id));
    }

    return list;
  }, [songs, query, categories, ids]);

  return { songs, results, allCategories, isLoading, error };
}
