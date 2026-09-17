/**
 * @module types/library
 * @description Tipos do índice da biblioteca de músicas.
 *
 * Formato em que o Worker devolve a biblioteca e que serviços e hooks consomem.
 */

/**
 * Entrada do índice de busca, derivada dos metadados (frontmatter YAML ou
 * diretivas ChordPro) de cada música ao salvá-la.
 */
export interface SongIndexEntry {
  /** Caminho/ID da música, ex: `harpa-crista/porque-ele-vive`. */
  readonly id: string;
  /** Título da música. */
  readonly title: string;
  /** Artista/intérprete. */
  readonly artist?: string;
  /** Tonalidade original (ex: `G`, `Am`). */
  readonly key?: string;
  /** Categorias (ex: `culto`, `santa ceia`). */
  readonly categories?: readonly string[];
  /** Tags livres. */
  readonly tags?: readonly string[];
  /** Idioma (ex: `pt`, `en`). */
  readonly language?: string;
  /** Andamento em BPM. */
  readonly tempo?: number;
  /** Nome do arquivo de origem. */
  readonly filename: string;
  /**
   * Letra em texto puro (sem acordes/diretivas), usada apenas para indexar a
   * busca por trechos. Não é exibida na UI.
   */
  readonly lyrics?: string;
}
