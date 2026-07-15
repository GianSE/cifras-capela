/**
 * @module lib/import/chord-detection
 * @description Heurísticas para detectar acordes e linhas de acordes em texto
 * bruto importado (TXT/PDF/HTML), reutilizando o parser de acordes do núcleo.
 */
import { parseChordString } from '@/lib/transpose/chord-parser';

/** Verifica se um token isolado é um acorde reconhecível. */
export function isChordToken(token: string): boolean {
  return parseChordString(token) !== null;
}

/**
 * Determina se uma linha é "somente acordes" (a maioria dos tokens são acordes).
 * Linhas vazias ou com diretivas `{...}` não contam.
 */
export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('{') || trimmed.startsWith('#')) return false;
  if (/\[[^\]]+\]/.test(line)) return false; // já tem acordes inline

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  const chordCount = tokens.filter(isChordToken).length;
  // Pelo menos 70% dos tokens devem ser acordes.
  return chordCount / tokens.length >= 0.7;
}

/** Encontra as posições (coluna, texto) de cada acorde numa linha de acordes. */
export function findChordPositions(line: string): Array<{ col: number; chord: string }> {
  const positions: Array<{ col: number; chord: string }> = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (isChordToken(match[0])) {
      positions.push({ col: match.index, chord: match[0] });
    }
  }
  return positions;
}
