/**
 * @module services/song-service
 * @description Ponto único de acesso às músicas.
 *
 * Escolhe o repositório conforme a configuração: Supabase (CRUD sincronizado)
 * quando há credenciais, senão o estático (arquivos do Git, somente leitura).
 * O resto do app não precisa saber qual está ativo.
 */

import { isSupabaseEnabled } from '@/lib/supabase/client';
import type { SongIndexEntry } from '@/types/library';
import type { SaveSongInput, SongRepository } from './song-repository';
import { staticRepository } from './static-repository';
import { supabaseRepository } from './supabase-repository';

const repository: SongRepository = isSupabaseEnabled ? supabaseRepository : staticRepository;

class SongService {
  /** `true` quando dá para criar/editar/excluir pelo app. */
  readonly canWrite = repository.canWrite;

  private sourceCache = new Map<string, string>();
  private readonly listeners = new Set<() => void>();

  /**
   * Assina mudanças na biblioteca (música criada, editada ou excluída).
   * Retorna a função de cancelamento.
   */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** Metadados de todas as músicas (para listar e buscar). */
  async getSongIndex(): Promise<SongIndexEntry[]> {
    return repository.listSongs();
  }

  /** O `.cho` completo de uma música (com cache em memória por sessão). */
  async getSongContent(id: string): Promise<string> {
    const cached = this.sourceCache.get(id);
    if (cached !== undefined) return cached;

    const source = await repository.getSource(id);
    this.sourceCache.set(id, source);
    return source;
  }

  /** Cria ou atualiza uma música. */
  async saveSong(input: SaveSongInput): Promise<void> {
    await repository.saveSong(input);
    // O conteúdo mudou: atualiza o cache da sessão e avisa a biblioteca.
    this.sourceCache.set(input.id, input.source);
    this.notify();
  }

  /** Exclui uma música. */
  async deleteSong(id: string): Promise<void> {
    await repository.deleteSong(id);
    this.sourceCache.delete(id);
    this.notify();
  }
}

export const songService = new SongService();
