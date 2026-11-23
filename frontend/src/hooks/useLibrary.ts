import { useEffect, useMemo, useState } from 'react';
import { useSongLibrary } from './useSongLibrary';
import { searchEngine } from '@/lib/search/search-engine';
import { songService } from '@/services/song-service';
import type { SongIndexEntry } from '@/types/library';

/** Abaixo disso, a busca por letra casaria meia biblioteca. */
const MIN_SERVER_QUERY = 3;
/** Espera o dedo parar antes de ir à rede — a busca local já respondeu. */
const SERVER_SEARCH_DEBOUNCE_MS = 250;

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
 *
 * A busca textual vem de dois lugares e os resultados são juntados: o
 * MiniSearch local responde na hora por título, artista, categoria e tag
 * (funciona offline), e o servidor acrescenta quem casou **pela letra**, pelo
 * índice FTS5. Os demais filtros são aplicados por cima dos dois.
 */
export function useLibrary(filter: LibraryFilter = {}) {
  const { songs, isLoading, error, source, staleSince } = useSongLibrary();
  const { query = '', categories = [], ids, keepIdOrder = false, maxIds } = filter;
  const trimmed = query.trim();

  /** Ids que o servidor achou pela letra; vazio enquanto não respondeu. */
  const [lyricHits, setLyricHits] = useState<readonly string[]>([]);

  useEffect(() => {
    if (trimmed.length < MIN_SERVER_QUERY) {
      setLyricHits([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      void songService.searchIds(trimmed).then((found) => {
        if (active) setLyricHits(found);
      });
    }, SERVER_SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const song of songs) {
      for (const c of song.categories ?? []) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [songs]);

  const results = useMemo(() => {
    let list: SongIndexEntry[] = trimmed
      ? searchEngine.search(trimmed)
      : [...songs].sort(byTitle);

    // Os ids do servidor entram no fim. Os que a busca local já achou (título,
    // artista) saem fora, e o que sobra é o "achei pelo trecho que eu
    // lembrava" — sinal mais fraco que um título batendo, então vem depois.
    if (trimmed && lyricHits.length > 0) {
      const seen = new Set(list.map((song) => song.id));
      const byId = new Map(songs.map((song) => [song.id, song] as const));
      const extra: SongIndexEntry[] = [];
      for (const id of lyricHits) {
        if (seen.has(id)) continue;
        const song = byId.get(id);
        if (song) extra.push(song);
      }
      if (extra.length > 0) list = [...list, ...extra];
    }

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
  }, [songs, trimmed, lyricHits, categories, ids, keepIdOrder, maxIds]);

  return { songs, results, allCategories, isLoading, error, source, staleSince };
}
