import { useState, useEffect, useMemo } from 'react';
import { songService } from '@/services/song-service';
import { searchEngine } from '@/lib/search/search-engine';
import type { SongIndexEntry } from '@/types/library';

export function useSongLibrary() {
  const [songs, setSongs] = useState<SongIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    songService
      .getSongIndex()
      .then((index) => {
        if (!mounted) return;
        setSongs(index);
        searchEngine.init(index);
        setIsLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Erro ao carregar a biblioteca de músicas.');
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { songs, isLoading, error };
}

export function useSearch(query: string) {
  const { songs, isLoading } = useSongLibrary();

  const results = useMemo(() => {
    if (isLoading) return [];
    if (!query || query.trim() === '') {
      return songs; // Return all if no query
    }
    return searchEngine.search(query);
  }, [query, songs, isLoading]);

  return { results, isLoading };
}
