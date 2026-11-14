/**
 * @module services/song-service
 * @description Ponto único de acesso às músicas.
 *
 * Fala com o Worker (D1) e, quando ele não responde, com a cópia local. O resto do app não precisa saber de onde veio.
 */

import type { LibraryLoad, SaveSongInput, SongRepository } from './song-repository';
import { workerRepository } from './worker-repository';

/**
 * A API do Worker vive na mesma origem do site, então está sempre disponível
 * — não há mais o "configurou ou não configurou" de quando os dados moravam
 * num serviço externo. Quando ela cai, quem cobre é o próprio repositório
 * (cache local).
 */
const repository: SongRepository = workerRepository;

class SongService {
  /** `true` quando dá para criar/editar/excluir pelo app. */
  readonly canWrite = repository.canWrite;

  private sourceCache = new Map<string, string>();
  private readonly listeners = new Set<() => void>();

  /**
   * Índice da biblioteca (metadados de todas as músicas), guardado por toda a
   * sessão: com ~16 mil músicas, buscar e reindexar (MiniSearch, com a letra
   * inteira) a cada tela aberta — biblioteca, playlist, modal de adicionar
   * música — travava a navegação. Só busca de novo quando uma música muda
   * (`notify`, abaixo) ou quando pedem explicitamente (`reload`).
   */
  private indexCache: LibraryLoad | null = null;
  private indexPromise: Promise<LibraryLoad> | null = null;

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
    this.indexCache = null;
    for (const listener of this.listeners) listener();
  }

  /**
   * Metadados de todas as músicas (para listar e buscar), com a informação de
   * se vieram da rede ou da cópia local — quem monta a tela precisa saber
   * para avisar que os dados podem estar velhos.
   *
   * Cacheado pela sessão: a 2ª tela que montar (ou a mesma, remontando) recebe
   * a mesma resposta na hora, sem repetir a ida à rede. Chamadas simultâneas
   * (duas telas montando ao mesmo tempo) compartilham a mesma requisição.
   */
  async getSongIndex(): Promise<LibraryLoad> {
    if (this.indexCache) return this.indexCache;
    if (!this.indexPromise) {
      this.indexPromise = repository.listSongs().finally(() => {
        this.indexPromise = null;
      });
    }
    const result = await this.indexPromise;
    this.indexCache = result;
    return result;
  }

  /** Força buscar a biblioteca de novo (ex.: botão "atualizar"). */
  async reloadSongIndex(): Promise<LibraryLoad> {
    this.indexCache = null;
    return this.getSongIndex();
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
