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
  /**
   * Sem busca, mantém a ordem de `ids` em vez da alfabética — os recentes
   * precisam aparecer do mais novo para o mais antigo.
   */
  keepIdOrder?: boolean;
  /**
   * Usa só os primeiros N de `ids` que ainda existem na biblioteca — uma
   * música apagada não ocupa vaga entre as recentes.
   */
  maxIds?: number;
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
  const { songs, isLoading, error, source, staleSince } = useSongLibrary();
  const { query = '', categories = [], ids, keepIdOrder = false, maxIds } = filter;

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
      const existing = new Set(songs.map((song) => song.id));
      const allowed = ids.filter((id) => existing.has(id)).slice(0, maxIds);
      const allow = new Set(allowed);
      list = list.filter((song) => allow.has(song.id));
      if (keepIdOrder && !trimmed) {
        const rank = new Map(allowed.map((id, i) => [id, i]));
        list.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
      }
    }

    return list;
  }, [songs, query, categories, ids, keepIdOrder, maxIds]);

  return { songs, results, allCategories, isLoading, error, source, staleSince };
}
