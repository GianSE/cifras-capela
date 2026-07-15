/**
 * Motor de transposição de acordes e músicas.
 *
 * Fornece funções puras (sem mutação) para transpor acordes individuais,
 * músicas inteiras, calcular posição do capotraste e derivar tonalidades.
 *
 * @module lib/transpose/transpose
 */

import type {
  NoteName,
  Accidental,
  Chord,
  Song,
  Section,
  Line,
  Segment,
} from '@/types/song';
import { noteToIndex, indexToNote } from '@/lib/transpose/chromatic';
import { parseChordString } from '@/lib/transpose/chord-parser';

/**
 * Transpõe um acorde a partir de sua **string**, retornando a nova string.
 *
 * É a API de conveniência da biblioteca reutilizável de transposição. Se a
 * entrada não for um acorde reconhecível, retorna a string original inalterada
 * (nunca lança exceção) — seguro para uso em pipelines de renderização.
 *
 * @param chord - Acorde como texto (ex.: `"C"`, `"F#m7"`, `"Bbmaj7"`, `"G/B"`).
 * @param semitones - Número de semitons (positivo = acima, negativo = abaixo).
 * @param preferFlats - Se `true`, usa bemóis; caso contrário, sustenidos (padrão).
 * @returns Novo acorde como string.
 *
 * @example
 * ```ts
 * transpose('C', 2);            // 'D'
 * transpose('F#m7', -3);        // 'Ebm7'
 * transpose('Bbmaj7', 5);       // 'Ebmaj7'
 * transpose('G/B', 1);          // 'G#/C'
 * transpose('C', 2, true);      // 'D'
 * ```
 */
export function transpose(chord: string, semitones: number, preferFlats = false): string {
  const parsed = parseChordString(chord);
  if (!parsed) {
    return chord;
  }
  return transposeChord(parsed, semitones, preferFlats).raw;
}

/**
 * Transpõe um único acorde pelo número especificado de semitons.
 *
 * Cria um **novo** objeto {@link Chord} — nunca muta o original.
 * Transpõe tanto a nota raiz quanto a nota do baixo (para slash chords).
 * Preserva qualidade e extensões exatamente como estavam.
 *
 * @param chord - Acorde a transpor.
 * @param semitones - Número de semitons (positivo = acima, negativo = abaixo).
 * @param preferFlats - Se `true`, usa bemóis; caso contrário, sustenidos.
 * @returns Novo acorde transposto.
 *
 * @example
 * ```ts
 * const Am = { root: 'A', quality: 'm', extensions: '', raw: 'Am' };
 * transposeChord(Am, 3, false);
 * // → { root: 'C', quality: 'm', extensions: '', raw: 'Cm' }
 * ```
 */
export function transposeChord(
  chord: Chord,
  semitones: number,
  preferFlats: boolean,
): Chord {
  // Transpor a nota raiz
  const rootIndex = noteToIndex(chord.root, chord.accidental);
  const newRootIndex = rootIndex + semitones;
  const newRoot = indexToNote(newRootIndex, preferFlats);

  // Transpor nota do baixo, se presente
  let newBass: { root: NoteName; accidental?: Accidental } | undefined;
  if (chord.bass) {
    const bassIndex = noteToIndex(chord.bass.root, chord.bass.accidental);
    const newBassIndex = bassIndex + semitones;
    newBass = indexToNote(newBassIndex, preferFlats);
  }

  // Reconstruir a string raw
  const rawRoot = newRoot.root + (newRoot.accidental ?? '');
  const rawQuality = chord.quality;
  const rawExtensions = chord.extensions;
  const rawBass = newBass
    ? '/' + newBass.root + (newBass.accidental ?? '')
    : '';
  const raw = rawRoot + rawQuality + rawExtensions + rawBass;

  // Construir novo acorde (imutável)
  return {
    root: newRoot.root,
    quality: chord.quality,
    extensions: chord.extensions,
    raw,
    ...(newRoot.accidental ? { accidental: newRoot.accidental } : {}),
    ...(newBass ? { bass: newBass } : {})
  } as Chord;
}

/**
 * Transpõe um segmento, criando uma cópia imutável com o acorde transposto.
 */
function transposeSegment(
  segment: Segment,
  semitones: number,
  preferFlats: boolean,
): Segment {
  if (!segment.chord) {
    return { lyric: segment.lyric };
  }
  return {
    chord: transposeChord(segment.chord, semitones, preferFlats),
    lyric: segment.lyric,
  };
}

/**
 * Transpõe uma linha, criando uma cópia imutável com todos os acordes transpostos.
 */
function transposeLine(
  line: Line,
  semitones: number,
  preferFlats: boolean,
): Line {
  return {
    type: line.type,
    segments: line.segments.map((seg) =>
      transposeSegment(seg, semitones, preferFlats),
    ),
    ...(line.comment !== undefined ? { comment: line.comment } : {})
  } as Line;
}

/**
 * Transpõe uma seção, criando uma cópia imutável com todas as linhas transpostas.
 */
function transposeSection(
  section: Section,
  semitones: number,
  preferFlats: boolean,
): Section {
  return {
    type: section.type,
    lines: section.lines.map((line) =>
      transposeLine(line, semitones, preferFlats),
    ),
    ...(section.label !== undefined ? { label: section.label } : {})
  } as Section;
}

/**
 * Transpõe **toda** a música (AST completa) pelo número especificado de semitons.
 *
 * Retorna uma **nova** {@link Song} — nunca muta a original.
 * Se `metadata.key` estiver definido, ele também é transposto.
 *
 * @param song - Música a transpor.
 * @param semitones - Número de semitons (positivo = acima, negativo = abaixo).
 * @param preferFlats - Se `true`, usa bemóis; caso contrário, sustenidos.
 * @returns Nova música com todos os acordes transpostos.
 *
 * @example
 * ```ts
 * const song: Song = { metadata: { title: 'Ex', key: 'C', custom: {} }, sections: [] };
 * const transposed = transposeSong(song, 2, false);
 * // transposed.metadata.key === 'D'
 * ```
 */
export function transposeSong(
  song: Song,
  semitones: number,
  preferFlats: boolean,
): Song {
  // Deep copy dos metadados
  const newMetadata = { ...song.metadata };

  // Copiar arrays e objetos de forma imutável
  if (song.metadata.tags) {
    newMetadata.tags = [...song.metadata.tags];
  }
  newMetadata.custom = { ...song.metadata.custom };

  // Transpor a tonalidade se presente
  if (newMetadata.key) {
    newMetadata.key = getKeyFromSemitones(
      newMetadata.key,
      semitones,
      preferFlats,
    );
  }

  return {
    metadata: newMetadata,
    sections: song.sections.map((section) =>
      transposeSection(section, semitones, preferFlats),
    ),
  };
}

/**
 * Calcula a posição do capotraste para tocar na tonalidade desejada.
 *
 * A fórmula é: `(índice_atual - índice_original + 12) % 12`.
 * Isso resulta no número de casas do capo necessárias.
 *
 * @param originalKey - Tonalidade original (ex.: "C", "F#m", "Bb").
 * @param currentKey - Tonalidade desejada para execução.
 * @returns Posição do capotraste (0–11).
 *
 * @example
 * ```ts
 * getCapo('C', 'E');   // 4
 * getCapo('G', 'A');   // 2
 * getCapo('C', 'C');   // 0
 * ```
 */
export function getCapo(originalKey: string, currentKey: string): number {
  const originalParsed = parseChordString(originalKey);
  const currentParsed = parseChordString(currentKey);

  if (!originalParsed || !currentParsed) {
    return 0;
  }

  const originalIndex = noteToIndex(
    originalParsed.root,
    originalParsed.accidental,
  );
  const currentIndex = noteToIndex(
    currentParsed.root,
    currentParsed.accidental,
  );

  return ((currentIndex - originalIndex) % 12 + 12) % 12;
}

/**
 * Obtém a nova tonalidade após transpor por N semitons.
 *
 * Preserva o sufixo da tonalidade (ex.: "m" em "Am" → "Cm").
 *
 * @param key - Tonalidade original como string (ex.: "C", "Am", "F#m").
 * @param semitones - Número de semitons a transpor.
 * @param preferFlats - Se `true`, usa bemóis; caso contrário, sustenidos.
 * @returns Nova tonalidade como string.
 *
 * @example
 * ```ts
 * getKeyFromSemitones('C', 2, false);    // 'D'
 * getKeyFromSemitones('Am', 3, false);   // 'Cm'
 * getKeyFromSemitones('F#', 1, true);    // 'G'
 * ```
 */
export function getKeyFromSemitones(
  key: string,
  semitones: number,
  preferFlats: boolean,
): string {
  const parsed = parseChordString(key);
  if (!parsed) {
    return key;
  }

  const rootIndex = noteToIndex(parsed.root, parsed.accidental);
  const newIndex = rootIndex + semitones;
  const newNote = indexToNote(newIndex, preferFlats);

  // Preservar sufixo (quality + extensions)
  const suffix = parsed.quality + parsed.extensions;
  return newNote.root + (newNote.accidental ?? '') + suffix;
}
