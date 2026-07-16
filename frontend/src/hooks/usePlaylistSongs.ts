import { useCallback, useState } from 'react';
import { songService } from '@/services/song-service';
import { parse } from '@/lib/parser';
import type { Song } from '@/types/song';

/** Música carregada, com o id preservado. */
export interface LoadedSong {
  readonly id: string;
  readonly song: Song;
}

/**
 * Carrega e parseia, sob demanda, todas as músicas de uma playlist — na ordem.
 *
 * Usado pela exportação em PDF: as cifras só são buscadas quando o usuário
 * pede o arquivo (o `songService` já faz cache em memória, e o service worker
 * garante que funcione offline).
 */
export function usePlaylistSongs() {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Busca as músicas na ordem dos IDs. Músicas que falharem são ignoradas
   * (uma cifra removida do repositório não impede a exportação das demais).
   *
   * O `id` volta junto com a AST porque quem chama precisa saber a qual música
   * cada resultado pertence — para aplicar o tom salvo dela.
   */
  const loadSongs = useCallback(async (songIds: readonly string[]): Promise<LoadedSong[]> => {
    setIsLoading(true);
    try {
      const results = await Promise.all(
        songIds.map(async (id): Promise<LoadedSong | null> => {
          try {
            const content = await songService.getSongContent(id);
            return { id, song: parse(content).song };
          } catch {
            console.warn(`Não foi possível carregar a música "${id}" para exportação.`);
            return null;
          }
        }),
      );
      return results.filter((entry): entry is LoadedSong => entry !== null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { loadSongs, isLoading };
}
