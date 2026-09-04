/**
 * @module services/song-service
 * @description Ponto único de acesso às músicas.
 *
 * Fala com o Worker (D1) e, quando ele não responde, com a cópia local ou
 * com os `.cho` versionados. O resto do app não precisa saber de onde veio.
 */

import type { LibraryLoad, SaveSongInput, SongRepository } from './song-repository';
import { workerRepository } from './worker-repository';

/**
 * A API do Worker vive na mesma origem do site, então está sempre disponível
 * — não há mais o "configurou ou não configurou" de quando os dados moravam
 * num serviço externo. Quando ela cai, quem cobre é o próprio repositório
 * (cache local e, no limite, os `.cho` versionados).
 */
const repository: SongRepository = workerRepository;

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

  /**
   * Metadados de todas as músicas (para listar e buscar), com a informação de
   * se vieram da rede ou da cópia local — quem monta a tela precisa saber
   * para avisar que os dados podem estar velhos.
   */
  async getSongIndex(): Promise<LibraryLoad> {
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
