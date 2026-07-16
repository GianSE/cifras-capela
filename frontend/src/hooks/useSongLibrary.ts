import { useState, useEffect, useMemo, useCallback } from 'react';
import { songService } from '@/services/song-service';
import { searchEngine } from '@/lib/search/search-engine';
import type { SongIndexEntry } from '@/types/library';

/**
 * Carrega a biblioteca e mantém o índice de busca sincronizado.
 *
 * Reage a mudanças no acervo (música criada, editada ou excluída) assinando o
 * `songService` — sem isso, uma música nova só apareceria após recarregar.
 */
export function useSongLibrary() {
  const [songs, setSongs] = useState<SongIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = () => {
      songService
        .getSongIndex()
        .then((index) => {
          if (!mounted) return;
          setSongs(index);
          searchEngine.init(index);
          setError(null);
          setIsLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setError('Erro ao carregar a biblioteca de músicas.');
          setIsLoading(false);
        });
    };

    load();
    const unsubscribe = songService.subscribe(load);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const reload = useCallback(() => {
    songService.getSongIndex().then((index) => {
      setSongs(index);
      searchEngine.init(index);
    });
  }, []);

  return { songs, isLoading, error, reload };
}

export function useSearch(query: string) {
  const { songs, isLoading } = useSongLibrary();

  const results = useMemo(() => {
    if (isLoading) return [];
    if (!query || query.trim() === '') {
      return songs; // Sem busca, devolve tudo
    }
    return searchEngine.search(query);
  }, [query, songs, isLoading]);

  return { results, isLoading };
}
