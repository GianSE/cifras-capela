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
 * Tira os parênteses das pontas de um token. Sites de cifra marcam trechos
 * instrumentais assim — `( Dm7  Bb  F  C )`, `(Bb  C/Bb  F)` — e os parênteses
 * não fazem parte do acorde. Sem isso, `(Bb` e `F)` não eram acordes e o
 * `(`/`)` soltos contavam como texto: a linha ficava abaixo dos 70% e virava
 * letra, que a transposição não alcança.
 */
function stripParens(token: string): { chord: string; offset: number } {
  const leading = /^\(*/.exec(token)![0].length;
  let chord = token.slice(leading);
  // Só sai o `)` que sobra. Acordes como `G6(9)` têm parênteses próprios e
  // equilibrados — arrancar o último deixaria `G6(9`, que não é acorde.
  const count = (s: string, c: string) => s.split(c).length - 1;
  while (chord.endsWith(')') && count(chord, ')') > count(chord, '(')) {
    chord = chord.slice(0, -1);
  }
  return { chord, offset: leading };
}

/**
 * Determina se uma linha é "somente acordes" (a maioria dos tokens são acordes).
 * Linhas vazias ou com diretivas `{...}` não contam.
 */
export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('{') || trimmed.startsWith('#')) return false;
  if (/\[[^\]]+\]/.test(line)) return false; // já tem acordes inline

  // Parênteses soltos ("( Dm7 ... )") somem em vez de contar como texto.
  const tokens = trimmed
    .split(/\s+/)
    .map((t) => stripParens(t).chord)
    .filter(Boolean);
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
    const { chord, offset } = stripParens(match[0]);
    if (chord && isChordToken(chord)) {
      // A coluna é a do acorde, não a do parêntese — é ela que alinha com a letra.
      positions.push({ col: match.index + offset, chord });
    }
  }
  return positions;
}
