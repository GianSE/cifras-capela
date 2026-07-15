import { describe, it, expect } from 'vitest';
import {
  transposeChord,
  transposeSong,
  getCapo,
  getKeyFromSemitones,
} from '../../src/lib/transpose/transpose';
import { noteToIndex, indexToNote } from '../../src/lib/transpose/chromatic';
import type { Chord, Song } from '../../src/types/song';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Cria um acorde simples para testes. */
function makeChord(raw: string, overrides: Partial<Chord> = {}): Chord {
  return {
    root: 'C',
    quality: '',
    extensions: '',
    raw,
    ...overrides,
  };
}

// ── noteToIndex / indexToNote ───────────────────────────────────────────────

describe('noteToIndex', () => {
  it('deve mapear C para 0', () => {
    expect(noteToIndex('C')).toBe(0);
  });

  it('deve mapear C# para 1', () => {
    expect(noteToIndex('C', '#')).toBe(1);
  });

  it('deve mapear Db para 1 (equivalente enarmônico de C#)', () => {
    expect(noteToIndex('D', 'b')).toBe(1);
  });

  it('deve mapear B para 11', () => {
    expect(noteToIndex('B')).toBe(11);
  });

  it('deve tratar B# como 0 (wrap-around)', () => {
    expect(noteToIndex('B', '#')).toBe(0);
  });

  it('deve tratar Cb como 11 (wrap-around)', () => {
    expect(noteToIndex('C', 'b')).toBe(11);
  });
});

describe('indexToNote', () => {
  it('deve retornar C para índice 0', () => {
    expect(indexToNote(0, false)).toEqual({ root: 'C' });
  });

  it('deve retornar C# para índice 1 (preferência sharps)', () => {
    expect(indexToNote(1, false)).toEqual({ root: 'C', accidental: '#' });
  });

  it('deve retornar Db para índice 1 (preferência flats)', () => {
    expect(indexToNote(1, true)).toEqual({ root: 'D', accidental: 'b' });
  });

  it('deve normalizar índices negativos', () => {
    expect(indexToNote(-1, false)).toEqual({ root: 'B' });
  });

  it('deve normalizar índices acima de 11', () => {
    expect(indexToNote(12, false)).toEqual({ root: 'C' });
  });
});

// ── transposeChord ─────────────────────────────────────────────────────────

describe('transposeChord', () => {
  it('deve transpor C para C# (1 semitom acima, sharps)', () => {
    const chord = makeChord('C', { root: 'C' });
    const result = transposeChord(chord, 1, false);
    expect(result.root).toBe('C');
    expect(result.accidental).toBe('#');
    expect(result.raw).toBe('C#');
  });

  it('deve transpor C para Db (1 semitom acima, flats)', () => {
    const chord = makeChord('C', { root: 'C' });
    const result = transposeChord(chord, 1, true);
    expect(result.root).toBe('D');
    expect(result.accidental).toBe('b');
    expect(result.raw).toBe('Db');
  });

  it('deve transpor C para D (2 semitons acima)', () => {
    const chord = makeChord('C', { root: 'C' });
    const result = transposeChord(chord, 2, false);
    expect(result.root).toBe('D');
    expect(result.raw).toBe('D');
  });

  it('deve transpor C para F (5 semitons acima)', () => {
    const chord = makeChord('C', { root: 'C' });
    const result = transposeChord(chord, 5, false);
    expect(result.root).toBe('F');
    expect(result.raw).toBe('F');
  });

  it('deve transpor C para G (7 semitons acima)', () => {
    const chord = makeChord('C', { root: 'C' });
    const result = transposeChord(chord, 7, false);
    expect(result.root).toBe('G');
    expect(result.raw).toBe('G');
  });

  it('deve transpor C por 12 semitons e retornar C (ciclo completo)', () => {
    const chord = makeChord('C', { root: 'C' });
    const result = transposeChord(chord, 12, false);
    expect(result.root).toBe('C');
    expect(result.accidental).toBeUndefined();
    expect(result.raw).toBe('C');
  });

  it('deve transpor B para C (wrap-around: +1 semitom)', () => {
    const chord = makeChord('B', { root: 'B' });
    const result = transposeChord(chord, 1, false);
    expect(result.root).toBe('C');
    expect(result.accidental).toBeUndefined();
  });

  it('deve transpor para baixo: D -2 semitons = C', () => {
    const chord = makeChord('D', { root: 'D' });
    const result = transposeChord(chord, -2, false);
    expect(result.root).toBe('C');
    expect(result.raw).toBe('C');
  });

  it('deve transpor para baixo: C -1 semitom = B', () => {
    const chord = makeChord('C', { root: 'C' });
    const result = transposeChord(chord, -1, false);
    expect(result.root).toBe('B');
  });

  it('deve preservar qualidade ao transpor Am para Cm (+3)', () => {
    const chord = makeChord('Am', { root: 'A', quality: 'm' });
    const result = transposeChord(chord, 3, false);
    expect(result.root).toBe('C');
    expect(result.quality).toBe('m');
    expect(result.raw).toBe('Cm');
  });

  it('deve preservar extensões ao transpor Cmaj7 → Dmaj7 (+2)', () => {
    const chord = makeChord('Cmaj7', {
      root: 'C',
      quality: 'maj',
      extensions: '7',
    });
    const result = transposeChord(chord, 2, false);
    expect(result.root).toBe('D');
    expect(result.quality).toBe('maj');
    expect(result.extensions).toBe('7');
    expect(result.raw).toBe('Dmaj7');
  });

  it('deve preservar extensões complexas: Bm7(b5) → Cm7(b5) (+1)', () => {
    const chord = makeChord('Bm7(b5)', {
      root: 'B',
      quality: 'm',
      extensions: '7(b5)',
    });
    const result = transposeChord(chord, 1, false);
    expect(result.root).toBe('C');
    expect(result.quality).toBe('m');
    expect(result.extensions).toBe('7(b5)');
    expect(result.raw).toBe('Cm7(b5)');
  });

  it('deve transpor slash chord C/E → D/F# (+2, sharps)', () => {
    const chord = makeChord('C/E', {
      root: 'C',
      bass: { root: 'E' },
    });
    const result = transposeChord(chord, 2, false);
    expect(result.root).toBe('D');
    expect(result.bass).toEqual({ root: 'F', accidental: '#' });
    expect(result.raw).toBe('D/F#');
  });

  it('deve transpor slash chord G/B → Ab/C (+1, flats)', () => {
    const chord = makeChord('G/B', {
      root: 'G',
      bass: { root: 'B' },
    });
    const result = transposeChord(chord, 1, true);
    expect(result.root).toBe('A');
    expect(result.accidental).toBe('b');
    expect(result.bass).toEqual({ root: 'C' });
    expect(result.raw).toBe('Ab/C');
  });

  it('deve transpor acorde com acidente na raiz: F#m → Am (+3)', () => {
    const chord = makeChord('F#m', {
      root: 'F',
      accidental: '#',
      quality: 'm',
    });
    const result = transposeChord(chord, 3, false);
    expect(result.root).toBe('A');
    expect(result.accidental).toBeUndefined();
    expect(result.quality).toBe('m');
    expect(result.raw).toBe('Am');
  });

  it('não deve mutar o acorde original', () => {
    const original = makeChord('C', { root: 'C' });
    const originalRaw = original.raw;
    transposeChord(original, 5, false);
    expect(original.root).toBe('C');
    expect(original.raw).toBe(originalRaw);
  });

  it('deve transpor Bb para B (+1, sharps)', () => {
    const chord = makeChord('Bb', {
      root: 'B',
      accidental: 'b',
    });
    const result = transposeChord(chord, 1, false);
    expect(result.root).toBe('B');
    expect(result.accidental).toBeUndefined();
  });
});

// ── getCapo ────────────────────────────────────────────────────────────────

describe('getCapo', () => {
  it('deve retornar 0 para mesma tonalidade (C → C)', () => {
    expect(getCapo('C', 'C')).toBe(0);
  });

  it('deve calcular capo de C → E = 4', () => {
    expect(getCapo('C', 'E')).toBe(4);
  });

  it('deve calcular capo de G → A = 2', () => {
    expect(getCapo('G', 'A')).toBe(2);
  });

  it('deve calcular capo de E → C = 8', () => {
    expect(getCapo('E', 'C')).toBe(8);
  });

  it('deve retornar 0 para entrada inválida', () => {
    expect(getCapo('xyz', 'C')).toBe(0);
  });

  it('deve funcionar com tonalidades com acidente: F# → A = 3', () => {
    expect(getCapo('F#', 'A')).toBe(3);
  });
});

// ── getKeyFromSemitones ────────────────────────────────────────────────────

describe('getKeyFromSemitones', () => {
  it('deve transpor C +2 → D', () => {
    expect(getKeyFromSemitones('C', 2, false)).toBe('D');
  });

  it('deve transpor Am +3 → Cm (preserva sufixo)', () => {
    expect(getKeyFromSemitones('Am', 3, false)).toBe('Cm');
  });

  it('deve transpor F# +1 → G', () => {
    expect(getKeyFromSemitones('F#', 1, false)).toBe('G');
  });

  it('deve usar flats quando preferFlats é true: C +1 → Db', () => {
    expect(getKeyFromSemitones('C', 1, true)).toBe('Db');
  });

  it('deve retornar a entrada original para chave inválida', () => {
    expect(getKeyFromSemitones('xyz', 3, false)).toBe('xyz');
  });

  it('deve transpor por 0 semitons e retornar a mesma tonalidade', () => {
    expect(getKeyFromSemitones('G', 0, false)).toBe('G');
  });

  it('deve transpor para baixo: D -2 → C', () => {
    expect(getKeyFromSemitones('D', -2, false)).toBe('C');
  });
});

// ── transposeSong ──────────────────────────────────────────────────────────

describe('transposeSong', () => {
  const baseSong: Song = {
    metadata: {
      title: 'Canção de teste',
      artist: 'Artista',
      key: 'C',
      tags: ['pop', 'rock'],
      custom: { fonte: 'original' },
    },
    sections: [
      {
        type: 'verse',
        label: 'Verso 1',
        lines: [
          {
            type: 'lyrics',
            segments: [
              {
                chord: {
                  root: 'C',
                  quality: '',
                  extensions: '',
                  raw: 'C',
                },
                lyric: 'Olá ',
              },
              {
                chord: {
                  root: 'G',
                  quality: '',
                  extensions: '',
                  raw: 'G',
                },
                lyric: 'mundo',
              },
            ],
          },
          {
            type: 'lyrics',
            segments: [
              {
                chord: {
                  root: 'A',
                  quality: 'm',
                  extensions: '',
                  raw: 'Am',
                },
                lyric: 'Como ',
              },
              {
                chord: {
                  root: 'F',
                  quality: '',
                  extensions: '',
                  raw: 'F',
                },
                lyric: 'vai?',
              },
            ],
          },
        ],
      },
      {
        type: 'chorus',
        label: 'Refrão',
        lines: [
          {
            type: 'chords-only',
            segments: [
              {
                chord: {
                  root: 'C',
                  quality: '',
                  extensions: '/E',
                  raw: 'C/E',
                  bass: { root: 'E' },
                } as any,
                lyric: '',
              },
            ],
          },
          {
            type: 'empty',
            segments: [{ lyric: '' }],
          },
          {
            type: 'comment',
            segments: [],
            comment: 'Repetir 2x',
          },
        ],
      },
    ],
  };

  it('deve transpor toda a música por 2 semitons', () => {
    const result = transposeSong(baseSong, 2, false);

    // Metadados
    expect(result.metadata.key).toBe('D');
    expect(result.metadata.title).toBe('Canção de teste');

    // Primeiro acorde do verso: C → D
    const firstChord = result.sections[0]!.lines[0]!.segments[0]!.chord;
    expect(firstChord).toBeDefined();
    expect(firstChord!.root).toBe('D');

    // Segundo acorde do verso: G → A
    const secondChord = result.sections[0]!.lines[0]!.segments[1]!.chord;
    expect(secondChord).toBeDefined();
    expect(secondChord!.root).toBe('A');

    // Am → Bm
    const thirdChord = result.sections[0]!.lines[1]!.segments[0]!.chord;
    expect(thirdChord).toBeDefined();
    expect(thirdChord!.root).toBe('B');
    expect(thirdChord!.quality).toBe('m');
  });

  it('não deve mutar a música original', () => {
    const result = transposeSong(baseSong, 5, false);
    expect(baseSong.metadata.key).toBe('C');
    expect(baseSong.sections[0]!.lines[0]!.segments[0]!.chord!.root).toBe('C');
    expect(result.metadata.key).not.toBe('C');
  });

  it('deve preservar labels das seções', () => {
    const result = transposeSong(baseSong, 3, false);
    expect(result.sections[0]!.label).toBe('Verso 1');
    expect(result.sections[1]!.label).toBe('Refrão');
  });

  it('deve preservar tipos de linha', () => {
    const result = transposeSong(baseSong, 1, false);
    expect(result.sections[0]!.lines[0]!.type).toBe('lyrics');
    expect(result.sections[1]!.lines[1]!.type).toBe('empty');
    expect(result.sections[1]!.lines[2]!.type).toBe('comment');
  });

  it('deve preservar letras inalteradas', () => {
    const result = transposeSong(baseSong, 7, false);
    expect(result.sections[0]!.lines[0]!.segments[0]!.lyric).toBe('Olá ');
    expect(result.sections[0]!.lines[0]!.segments[1]!.lyric).toBe('mundo');
  });

  it('deve preservar comentários', () => {
    const result = transposeSong(baseSong, 1, false);
    expect(result.sections[1]!.lines[2]!.comment).toBe('Repetir 2x');
  });

  it('deve preservar tags e custom de forma imutável', () => {
    const result = transposeSong(baseSong, 1, false);
    expect(result.metadata.tags).toEqual(['pop', 'rock']);
    expect(result.metadata.custom).toEqual({ fonte: 'original' });
    // Verificar que são cópias, não referências
    expect(result.metadata.tags).not.toBe(baseSong.metadata.tags);
    expect(result.metadata.custom).not.toBe(baseSong.metadata.custom);
  });

  it('deve lidar com música sem key nos metadados', () => {
    const songNoKey: Song = {
      metadata: { title: 'Sem tom', custom: {} },
      sections: [],
    };
    const result = transposeSong(songNoKey, 5, false);
    expect(result.metadata.key).toBeUndefined();
  });

  it('deve transpor segmentos sem acorde sem erro', () => {
    const songWithEmptySegment: Song = {
      metadata: { title: 'Teste', key: 'C', custom: {} },
      sections: [
        {
          type: 'verse',
          lines: [
            {
              type: 'lyrics',
              segments: [{ lyric: 'Apenas texto' }],
            },
          ],
        },
      ],
    };
    const result = transposeSong(songWithEmptySegment, 3, false);
    expect(result.sections[0]!.lines[0]!.segments[0]!.lyric).toBe(
      'Apenas texto',
    );
    expect(result.sections[0]!.lines[0]!.segments[0]!.chord).toBeUndefined();
  });
});
