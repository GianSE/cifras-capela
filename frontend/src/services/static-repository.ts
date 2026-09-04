/**
 * @module services/static-repository
 * @description Biblioteca somente leitura, servida pelos arquivos versionados
 * no Git (`public/songs/`) + o índice gerado no build.
 *
 * É a rede de segurança da biblioteca: funciona 100% offline porque o
 * service worker pré-cacheia o índice e os `.cho`.
 */

import type { SongIndexEntry } from '@/types/library';
import {
  ReadOnlyLibraryError,
  type LibraryLoad,
  type SongRepository,
} from './song-repository';

class StaticSongRepository implements SongRepository {
  readonly canWrite = false;

  private indexCache: SongIndexEntry[] | null = null;
  private inFlight: Promise<SongIndexEntry[]> | null = null;

  /**
   * O índice vem do service worker quando não há rede, então uma falha aqui é
   * um problema de verdade — e é propagada em vez de virar lista vazia, que a
   * tela mostraria como "Nenhuma música encontrada".
   */
  async listSongs(): Promise<LibraryLoad> {
    if (this.indexCache) return { entries: this.indexCache, source: 'static', fromCache: false };

    this.inFlight ??= fetch('/songs/index.json')
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao buscar o índice de músicas');
        return res.json() as Promise<SongIndexEntry[]>;
      })
      .then((index) => {
        this.indexCache = index;
        return index;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return { entries: await this.inFlight, source: 'static', fromCache: false };
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
