/**
 * @module types/playlist
 * @description Tipos das playlists (setlists) montadas pelo usuário.
 */

export interface Playlist {
  /** Identificador único e estável. */
  readonly id: string;
  /** Nome dado pelo usuário (ex.: "Culto de domingo 20/07"). */
  readonly name: string;
  /**
   * IDs das músicas, **na ordem de execução**.
   * É esta ordem que o arrastar-e-soltar altera e que o PDF respeita.
   */
  readonly songIds: readonly string[];
  /** Timestamp ISO de criação. */
  readonly createdAt: string;
  /** Timestamp ISO da última alteração. */
  readonly updatedAt: string;
}
