/**
 * @module services/song-repository
 * @description Abstração de onde as músicas vivem.
 *
 * Implementação atual: o **Worker**, com CRUD real no D1, sincronizado entre
 * dispositivos, e cache local para continuar lendo sem internet.
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
   *  - `cache`: a rede falhou e isto é a última cópia local.
   */
  readonly source: 'network' | 'cache';
  /** `true` quando os dados podem estar desatualizados (cache). */
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
  /**
   * Ids das músicas cujo título, artista **ou letra** casam com o texto, da
   * mais relevante para a menos.
   *
   * É o que o índice não dá mais: a letra ficou no servidor. Exige rede —
   * offline, quem responde é só a busca local por título e artista.
   */
  searchIds(query: string): Promise<readonly string[]>;
  /**
   * A letra em texto puro destas músicas, por id. Ids sem letra (ou que não
   * existem) simplesmente não aparecem no resultado.
   */
  getLyrics(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
  /**
   * A letra de **toda** a biblioteca, em páginas. Só para a auditoria, que
   * compara letra a letra e roda sob pedido; `onPage` acompanha o progresso.
   */
  getAllLyrics(onPage?: (loaded: number) => void): Promise<ReadonlyMap<string, string>>;
  /** Cria ou atualiza. Só quando `canWrite`. */
  saveSong(input: SaveSongInput): Promise<void>;
  /** Exclui. Só quando `canWrite`. */
  deleteSong(id: string): Promise<void>;
}
