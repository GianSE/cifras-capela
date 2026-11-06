/**
 * @module types/playlist
 * @description Tipos das playlists (setlists) montadas pelo usuário.
 */

/**
 * Tipo da playlist:
 *  - `lista` → setlist comum, uma fila de músicas;
 *  - `missa` → organizada pelas partes da missa (Entrada, Glória, Santo…).
 */
export type PlaylistKind = 'lista' | 'missa';

/** Uma parte da missa (ex.: "Entrada") e as músicas escolhidas para ela. */
export interface PlaylistSection {
  /** Identificador estável (não muda ao renomear). */
  readonly id: string;
  /** Nome exibido — editável pelo usuário. */
  readonly name: string;
  /** Músicas desta parte, na ordem de execução. */
  readonly songIds: readonly string[];
}

export interface Playlist {
  /** Identificador único e estável. */
  readonly id: string;
  /** Nome dado pelo usuário (ex.: "Culto de domingo 20/07"). */
  readonly name: string;
  /**
   * IDs das músicas, **na ordem de execução**.
   * É esta ordem que o arrastar-e-soltar altera e que o PDF respeita.
   *
   * Na missa é derivada das partes (a de cima primeiro) — fica guardada
   * mesmo assim para o leitor, o PDF e as contagens não precisarem saber
   * que existem partes.
   */
  readonly songIds: readonly string[];
  /** Ausente = `lista` (playlists criadas antes da missa existir). */
  readonly kind?: PlaylistKind;
  /** Só na missa: as partes, na ordem da celebração. */
  readonly sections?: readonly PlaylistSection[];
  /** Timestamp ISO de criação. */
  readonly createdAt: string;
  /** Timestamp ISO da última alteração. */
  readonly updatedAt: string;
}
