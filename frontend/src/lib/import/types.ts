/**
 * @module lib/import/types
 * @description Tipos compartilhados pelos importadores.
 */

/** Resultado de uma importação, pronto para a tela de revisão. */
export interface ImportedSong {
  title?: string;
  artist?: string;
  key?: string;
  categories?: string[];
  tags?: string[];
  language?: string;
  tempo?: number;
  capo?: number;
  /** Corpo já no formato ChordPro inline (seções + `[acordes]`). */
  body: string;
  /** Avisos das heurísticas (campos que podem precisar de revisão). */
  warnings: string[];
}
