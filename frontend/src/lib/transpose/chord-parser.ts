/**
 * Parser de acordes musicais a partir de texto.
 *
 * Converte uma string como `"F#m7(b5)/E"` em uma estrutura {@link Chord}
 * com raiz, acidente, qualidade, extensões e baixo separados.
 *
 * @module lib/transpose/chord-parser
 */

import type { NoteName, Accidental, Chord } from '@/types/song';

/** Conjunto de nomes de nota válidos para validação rápida. */
const VALID_NOTES: ReadonlySet<string> = new Set<string>([
  'A', 'B', 'C', 'D', 'E', 'F', 'G',
]);

/**
 * Expressão regular para decompor uma string de acorde em seus componentes.
 *
 * Grupos nomeados:
 * - `root`: nota fundamental (A–G)
 * - `accidental`: sustenido ou bemol (# ou b), opcional
 * - `quality`: qualidade do acorde (m, min, maj, dim, aug, sus, M, +, °, ø, Δ), opcional
 * - `extensions`: extensões numéricas e alterações (com ou sem parênteses), opcional
 * - `bassRoot`: nota do baixo para slash chords (A–G), opcional
 * - `bassAccidental`: acidente do baixo (# ou b), opcional
 *
 * As extensões aceitam tanto a forma entre parênteses `7(b5)` quanto a forma
 * "solta" `7b5`, `9#11`, além de `add9`, `sus2`, `no3`, etc. Como a transposição
 * só toca em raiz/baixo, qualquer sufixo é preservado verbatim.
 */
const CHORD_REGEX =
  /^(?<root>[A-G])(?<accidental>[#b])?(?<quality>maj|min|dim|aug|sus|m|M|\+|°|ø|Δ)?(?<extensions>(?:\d+|add\d+|sus\d+|no\d+|maj\d+|[#b]\d+|\([-\w#b,+]+\))*)?(?:\/(?<bassRoot>[A-G])(?<bassAccidental>[#b])?)?$/;

/**
 * Analisa uma string de acorde e retorna uma representação estruturada.
 *
 * Aceita formatos como:
 * - Simples: `A`, `C`, `G`
 * - Menores: `Am`, `Bm`
 * - Com sétimas: `A7`, `Am7`, `Amaj7`
 * - Estendidos: `Aadd9`, `Asus2`, `Asus4`, `Adim`, `Aaug`
 * - Com acidentes: `A#`, `Bb`, `C#`, `Db`
 * - Complexos: `Bm7(b5)`, `Eb7(#9)`, `F#m11`, `Cmaj9`
 * - Slash chords: `C/E`, `G/B`, `D/F#`
 * - Combinados: `F#m7(b5)/E`, `Bbmaj7/D`
 *
 * @param input - String do acorde a ser analisada.
 * @returns Objeto {@link Chord} com os componentes separados, ou `null` se inválido.
 *
 * @example
 * ```ts
 * parseChordString('Am7');
 * // { root: 'A', quality: 'm', extensions: '7', bass: undefined, raw: 'Am7' }
 *
 * parseChordString('F#m7(b5)/E');
 * // {
 * //   root: 'F', accidental: '#', quality: 'm', extensions: '7(b5)',
 * //   bass: { root: 'E' }, raw: 'F#m7(b5)/E'
 * // }
 *
 * parseChordString('xyz');
 * // null
 * ```
 */
export function parseChordString(input: string): Chord | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = CHORD_REGEX.exec(trimmed);
  if (!match?.groups) {
    return null;
  }

  const { root, accidental, quality, extensions, bassRoot, bassAccidental } =
    match.groups;

  // Validação extra da nota raiz
  if (!root || !VALID_NOTES.has(root)) {
    return null;
  }

  // Construir o acorde
  const baseChord = {
    root: root as NoteName,
    quality: quality ?? '',
    extensions: extensions ?? '',
    raw: trimmed,
    ...(accidental ? { accidental: accidental as Accidental } : {}),
  };

  // Adicionar nota do baixo se presente (slash chord)
  if (bassRoot && VALID_NOTES.has(bassRoot)) {
    const bass = {
      root: bassRoot as NoteName,
      ...(bassAccidental ? { accidental: bassAccidental as Accidental } : {}),
    };
    return { ...baseChord, bass } as Chord;
  }

  return baseChord as Chord;
}
