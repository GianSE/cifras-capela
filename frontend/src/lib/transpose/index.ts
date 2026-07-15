/**
 * API pública do motor de transposição de acordes.
 *
 * @example
 * ```ts
 * import {
 *   parseChordString,
 *   transposeChord,
 *   transposeSong,
 *   getCapo,
 *   getKeyFromSemitones,
 *   noteToIndex,
 *   indexToNote,
 *   SHARPS,
 *   FLATS,
 * } from '@/lib/transpose';
 * ```
 *
 * @module lib/transpose
 */

export { SHARPS, FLATS, noteToIndex, indexToNote } from '@/lib/transpose/chromatic';
export { parseChordString } from '@/lib/transpose/chord-parser';
export {
  transpose,
  transposeChord,
  transposeSong,
  getCapo,
  getKeyFromSemitones,
} from '@/lib/transpose/transpose';
