/**
 * Escala cromática e mapeamento de notas.
 *
 * Fornece constantes e funções para converter entre notas musicais
 * e seus índices na escala cromática (0–11).
 *
 * @module lib/transpose/chromatic
 */

import type { NoteName, Accidental } from '@/types/song';

/**
 * Escala cromática com preferência por sustenidos.
 * Índice 0 = C, 1 = C#, ..., 11 = B.
 */
export const SHARPS: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

/**
 * Escala cromática com preferência por bemóis.
 * Índice 0 = C, 1 = Db, ..., 11 = B.
 */
export const FLATS: readonly string[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const;

/**
 * Mapeamento de nota natural para seu índice na escala cromática.
 * C=0, D=2, E=4, F=5, G=7, A=9, B=11.
 */
const NOTE_TO_INDEX: Readonly<Record<NoteName, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Converte uma nota (raiz + acidente opcional) para seu índice cromático (0–11).
 *
 * @param root - Nome da nota (A–G).
 * @param accidental - Acidente opcional (# ou b).
 * @returns Índice cromático normalizado entre 0 e 11.
 *
 * @example
 * ```ts
 * noteToIndex('C');       // 0
 * noteToIndex('C', '#');  // 1
 * noteToIndex('D', 'b');  // 1
 * noteToIndex('B', '#');  // 0  (wrap-around)
 * ```
 */
export function noteToIndex(root: NoteName, accidental?: Accidental): number {
  const base = NOTE_TO_INDEX[root];
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return ((base + offset) % 12 + 12) % 12;
}

/**
 * Converte um índice cromático (0–11) de volta para nota + acidente.
 *
 * @param index - Índice cromático (será normalizado para 0–11).
 * @param preferFlats - Se `true`, usa bemóis (Db, Eb…); caso contrário, sustenidos (C#, D#…).
 * @returns Objeto com `root` e `accidental` opcional.
 *
 * @example
 * ```ts
 * indexToNote(1, false);  // { root: 'C', accidental: '#' }
 * indexToNote(1, true);   // { root: 'D', accidental: 'b' }
 * indexToNote(0, false);  // { root: 'C' }
 * ```
 */
export function indexToNote(
  index: number,
  preferFlats: boolean,
): { root: NoteName; accidental?: Accidental } {
  const normalizedIndex = ((index % 12) + 12) % 12;
  const scale = preferFlats ? FLATS : SHARPS;
  const noteString = scale[normalizedIndex]!;

  if (noteString.length === 1) {
    return { root: noteString as NoteName };
  }

  return {
    root: noteString[0] as NoteName,
    accidental: noteString[1] as Accidental,
  };
}
