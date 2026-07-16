/**
 * @module services/static-repository
 * @description Biblioteca somente leitura, servida pelos arquivos versionados
 * no Git (`public/songs/`) + o índice gerado no build.
 *
 * É o modo padrão quando o Supabase não está configurado. Funciona 100%
 * offline porque o service worker pré-cacheia o índice e os `.cho`.
 */

import type { SongIndexEntry } from '@/types/library';
import { ReadOnlyLibraryError, type SongRepository } from './song-repository';

class StaticSongRepository implements SongRepository {
  readonly canWrite = false;

  private indexCache: SongIndexEntry[] | null = null;
  private inFlight: Promise<SongIndexEntry[]> | null = null;

  async listSongs(): Promise<SongIndexEntry[]> {
    if (this.indexCache) return this.indexCache;
    if (this.inFlight) return this.inFlight;

    this.inFlight = fetch('/songs/index.json')
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao buscar o índice de músicas');
        return res.json() as Promise<SongIndexEntry[]>;
      })
      .then((index) => {
        this.indexCache = index;
        return index;
      })
      .catch((err) => {
        console.error('Erro ao carregar o índice de músicas:', err);
        return [];
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  async getSource(id: string): Promise<string> {
    const response = await fetch(`/songs/${id}.cho`);
    if (!response.ok) {
      throw new Error(`Não foi possível carregar a música "${id}".`);
    }
    return response.text();
  }

  saveSong(): Promise<void> {
    return Promise.reject(new ReadOnlyLibraryError());
  }

  deleteSong(): Promise<void> {
    return Promise.reject(new ReadOnlyLibraryError());
  }
}

export const staticRepository = new StaticSongRepository();
