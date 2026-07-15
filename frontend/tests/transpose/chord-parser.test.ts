import { describe, it, expect } from 'vitest';
import { parseChordString } from '../../src/lib/transpose/chord-parser';

describe('parseChordString', () => {
  // ── Acordes simples (A–G) ──────────────────────────────────────────────

  it.each(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const)(
    'deve analisar nota simples: %s',
    (note) => {
      const result = parseChordString(note);
      expect(result).not.toBeNull();
      expect(result!.root).toBe(note);
      expect(result!.accidental).toBeUndefined();
      expect(result!.quality).toBe('');
      expect(result!.extensions).toBe('');
      expect(result!.bass).toBeUndefined();
      expect(result!.raw).toBe(note);
    },
  );

  // ── Acordes menores ────────────────────────────────────────────────────

  it('deve analisar Am', () => {
    const result = parseChordString('Am');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('m');
    expect(result!.extensions).toBe('');
  });

  it('deve analisar Bm', () => {
    const result = parseChordString('Bm');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('B');
    expect(result!.quality).toBe('m');
  });

  it('deve analisar Cm', () => {
    const result = parseChordString('Cm');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('C');
    expect(result!.quality).toBe('m');
  });

  // ── Acordes com sétima ─────────────────────────────────────────────────

  it('deve analisar A7', () => {
    const result = parseChordString('A7');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('');
    expect(result!.extensions).toBe('7');
  });

  it('deve analisar Am7', () => {
    const result = parseChordString('Am7');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('m');
    expect(result!.extensions).toBe('7');
  });

  it('deve analisar Amaj7', () => {
    const result = parseChordString('Amaj7');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('maj');
    expect(result!.extensions).toBe('7');
  });

  // ── Acordes estendidos ─────────────────────────────────────────────────

  it('deve analisar Aadd9', () => {
    const result = parseChordString('Aadd9');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('');
    expect(result!.extensions).toBe('add9');
  });

  it('deve analisar Asus2', () => {
    const result = parseChordString('Asus2');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('sus');
    expect(result!.extensions).toBe('2');
  });

  it('deve analisar Asus4', () => {
    const result = parseChordString('Asus4');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('sus');
    expect(result!.extensions).toBe('4');
  });

  it('deve analisar Adim', () => {
    const result = parseChordString('Adim');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('dim');
    expect(result!.extensions).toBe('');
  });

  it('deve analisar Aaug', () => {
    const result = parseChordString('Aaug');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('aug');
    expect(result!.extensions).toBe('');
  });

  // ── Acidentes na raiz ──────────────────────────────────────────────────

  it('deve analisar A# (sustenido)', () => {
    const result = parseChordString('A#');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.accidental).toBe('#');
  });

  it('deve analisar Bb (bemol)', () => {
    const result = parseChordString('Bb');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('B');
    expect(result!.accidental).toBe('b');
  });

  it('deve analisar C#', () => {
    const result = parseChordString('C#');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('C');
    expect(result!.accidental).toBe('#');
  });

  it('deve analisar Db', () => {
    const result = parseChordString('Db');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('D');
    expect(result!.accidental).toBe('b');
  });

  it('deve analisar Eb', () => {
    const result = parseChordString('Eb');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('E');
    expect(result!.accidental).toBe('b');
  });

  it('deve analisar F#', () => {
    const result = parseChordString('F#');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('F');
    expect(result!.accidental).toBe('#');
  });

  it('deve analisar Gb', () => {
    const result = parseChordString('Gb');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('G');
    expect(result!.accidental).toBe('b');
  });

  // ── Acordes complexos ──────────────────────────────────────────────────

  it('deve analisar Bm7(b5)', () => {
    const result = parseChordString('Bm7(b5)');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('B');
    expect(result!.quality).toBe('m');
    expect(result!.extensions).toBe('7(b5)');
  });

  it('deve analisar Eb7(#9)', () => {
    const result = parseChordString('Eb7(#9)');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('E');
    expect(result!.accidental).toBe('b');
    expect(result!.quality).toBe('');
    expect(result!.extensions).toBe('7(#9)');
  });

  it('deve analisar F#m11', () => {
    const result = parseChordString('F#m11');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('F');
    expect(result!.accidental).toBe('#');
    expect(result!.quality).toBe('m');
    expect(result!.extensions).toBe('11');
  });

  it('deve analisar Cmaj9', () => {
    const result = parseChordString('Cmaj9');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('C');
    expect(result!.quality).toBe('maj');
    expect(result!.extensions).toBe('9');
  });

  // ── Slash chords ───────────────────────────────────────────────────────

  it('deve analisar C/E (slash chord)', () => {
    const result = parseChordString('C/E');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('C');
    expect(result!.bass).toEqual({ root: 'E' });
  });

  it('deve analisar G/B (slash chord)', () => {
    const result = parseChordString('G/B');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('G');
    expect(result!.bass).toEqual({ root: 'B' });
  });

  it('deve analisar D/F# (slash chord com acidente no baixo)', () => {
    const result = parseChordString('D/F#');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('D');
    expect(result!.bass).toEqual({ root: 'F', accidental: '#' });
  });

  // ── Combinações complexas ──────────────────────────────────────────────

  it('deve analisar Bbm7/Ab', () => {
    const result = parseChordString('Bbm7/Ab');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('B');
    expect(result!.accidental).toBe('b');
    expect(result!.quality).toBe('m');
    expect(result!.extensions).toBe('7');
    expect(result!.bass).toEqual({ root: 'A', accidental: 'b' });
  });

  it('deve analisar F#m7(b5)/E', () => {
    const result = parseChordString('F#m7(b5)/E');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('F');
    expect(result!.accidental).toBe('#');
    expect(result!.quality).toBe('m');
    expect(result!.extensions).toBe('7(b5)');
    expect(result!.bass).toEqual({ root: 'E' });
  });

  it('deve analisar Bbmaj7/D', () => {
    const result = parseChordString('Bbmaj7/D');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('B');
    expect(result!.accidental).toBe('b');
    expect(result!.quality).toBe('maj');
    expect(result!.extensions).toBe('7');
    expect(result!.bass).toEqual({ root: 'D' });
  });

  // ── Entradas inválidas ─────────────────────────────────────────────────

  it('deve retornar null para string vazia', () => {
    expect(parseChordString('')).toBeNull();
  });

  it('deve retornar null para entrada inválida "xyz"', () => {
    expect(parseChordString('xyz')).toBeNull();
  });

  it('deve retornar null para nota minúscula "am"', () => {
    expect(parseChordString('am')).toBeNull();
  });

  it('deve retornar null para entrada com apenas números "123"', () => {
    expect(parseChordString('123')).toBeNull();
  });

  // ── Qualidades alternativas ────────────────────────────────────────────

  it('deve analisar A° (diminuto com símbolo)', () => {
    const result = parseChordString('A°');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('°');
  });

  it('deve analisar C+ (aumentado com símbolo)', () => {
    const result = parseChordString('C+');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('C');
    expect(result!.quality).toBe('+');
  });

  it('deve analisar AM7 (M maiúsculo para maior)', () => {
    const result = parseChordString('AM7');
    expect(result).not.toBeNull();
    expect(result!.root).toBe('A');
    expect(result!.quality).toBe('M');
    expect(result!.extensions).toBe('7');
  });

  // ── Preservação do campo raw ───────────────────────────────────────────

  it('deve preservar o campo raw com o valor original', () => {
    const result = parseChordString('F#m7(b5)/E');
    expect(result).not.toBeNull();
    expect(result!.raw).toBe('F#m7(b5)/E');
  });
});
