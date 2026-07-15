/**
 * @module lib/import/positional
 * @description Converte "acordes acima da letra" (posicionais) em acordes
 * inline `[C]` no formato ChordPro, mantendo o alinhamento por coluna.
 */
import { findChordPositions } from './chord-detection';

/**
 * Funde uma linha de acordes com a linha de letra logo abaixo, inserindo cada
 * acorde inline na coluna correspondente.
 *
 * @example
 * mergeChordLine('    G       C', 'Porque Ele vive')
 * // → 'Porq[G]ue Ele [C]vive'  (aproximado pela coluna)
 */
export function mergeChordLine(chordLine: string, lyricLine: string): string {
  const positions = findChordPositions(chordLine);
  if (positions.length === 0) return lyricLine;

  // Garante que a letra tenha comprimento suficiente para as colunas.
  let lyric = lyricLine;
  const maxCol = positions[positions.length - 1]!.col;
  if (lyric.length < maxCol) {
    lyric = lyric.padEnd(maxCol, ' ');
  }

  // Insere da direita para a esquerda para não invalidar as posições.
  for (let i = positions.length - 1; i >= 0; i--) {
    const { col, chord } = positions[i]!;
    const insertAt = Math.min(col, lyric.length);
    lyric = `${lyric.slice(0, insertAt)}[${chord}]${lyric.slice(insertAt)}`;
  }

  return lyric.replace(/\s+$/, '');
}

/** Converte uma linha só de acordes (sem letra abaixo) em inline `[C] [D]`. */
export function chordOnlyToInline(chordLine: string): string {
  return findChordPositions(chordLine)
    .map((p) => `[${p.chord}]`)
    .join(' ');
}
