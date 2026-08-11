import { useState, useEffect, useCallback } from 'react';
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
  /** Data da cópia em cache quando a rede falhou (nulo = dados frescos). */
  const [staleSince, setStaleSince] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = () => {
      songService
        .getSongIndex()
        .then(({ entries: index, fromCache, cachedAt }) => {
          if (!mounted) return;
          setSongs(index);
          searchEngine.init(index);
          setError(null);
          setStaleSince(fromCache ? (cachedAt ?? '') : null);
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
    songService.getSongIndex().then(({ entries: index, fromCache, cachedAt }) => {
      setSongs(index);
      searchEngine.init(index);
      setStaleSince(fromCache ? (cachedAt ?? '') : null);
    });
  }, []);

  return { songs, isLoading, error, staleSince, reload };
}
