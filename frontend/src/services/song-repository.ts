/**
 * @module services/song-repository
 * @description Abstração de onde as músicas vivem.
 *
 * Duas implementações:
 *
 *  - **estática**: lê os `.cho` versionados em `public/songs/` via o índice
 *    gerado no build. Somente leitura, funciona 100% offline — é o piso a que
 *    o app recorre quando tudo o mais falha.
 *  - **Worker**: CRUD real no D1, sincronizado entre dispositivos, com cache
 *    local para continuar lendo sem internet.
 *
 * O resto do app fala só com esta interface e não sabe de onde vêm os dados.
 */

import type { SongIndexEntry } from '@/types/library';

export interface SaveSongInput {
  /** Id no formato `categoria/slug`. Novo ou existente (upsert). */
  readonly id: string;
  /** Arquivo `.cho` completo — a fonte da verdade. */
  readonly source: string;
}

/**
 * Resultado de uma carga da biblioteca.
 *
 * Diz **de onde** os dados vieram, não só quais são. Antes, quem falhava
 * devolvia uma lista vazia: uma queda de rede virava "Nenhuma música
 * encontrada" na tela, indistinguível de uma biblioteca realmente vazia, e
 * quem lia do cache não tinha como avisar que os dados podiam estar velhos.
 */
export interface LibraryLoad {
  readonly entries: SongIndexEntry[];
  /**
   * De onde vieram estes dados:
   *  - `network`: o servidor respondeu, está fresco;
   *  - `cache`: a rede falhou e isto é a última cópia local;
   *  - `static`: nem rede nem cache — são os `.cho` versionados no Git, que
   *    vêm junto com o app e sempre existem. É o piso que garante que a
   *    biblioteca nunca apareça vazia.
   */
  readonly source: 'network' | 'cache' | 'static';
  /** `true` quando os dados podem estar desatualizados (cache ou estático). */
  readonly fromCache: boolean;
  /** Quando a cópia local foi gravada (ISO), se veio do cache. */
  readonly cachedAt?: string;
}

export interface SongRepository {
  /** `true` quando dá para criar/editar/excluir por aqui. */
  readonly canWrite: boolean;
  /**
   * Todas as músicas da biblioteca (metadados para listagem/busca).
   * **Lança** quando não consegue nem da rede nem do cache — quem chama
   * precisa poder distinguir "vazia" de "não deu para carregar".
   */
  listSongs(): Promise<LibraryLoad>;
  /** O `.cho` completo de uma música. */
  getSource(id: string): Promise<string>;
  /** Cria ou atualiza. Só quando `canWrite`. */
  saveSong(input: SaveSongInput): Promise<void>;
  /** Exclui. Só quando `canWrite`. */
  deleteSong(id: string): Promise<void>;
}

/** Erro de escrita numa biblioteca somente leitura. */
export class ReadOnlyLibraryError extends Error {
  constructor() {
    super(
      'Esta biblioteca é somente leitura. Entre na sua conta para criar e editar músicas pelo app.',
    );
    this.name = 'ReadOnlyLibraryError';
  }
}
