import { describe, it, expect } from 'vitest';
import { transpose } from '../../src/lib/transpose';

/**
 * Testes da API pública de conveniência `transpose(chordString, semitones)`,
 * conforme especificado: aceita qualquer acorde e sempre retorna a string correta.
 */
describe('transpose (string → string)', () => {
  it('transpõe uma nota simples para cima', () => {
    expect(transpose('C', 2)).toBe('D');
  });

  it('transpõe uma nota simples para baixo (padrão sustenidos)', () => {
    expect(transpose('C', -2)).toBe('A#');
  });

  it('transpõe para baixo com preferência por bemóis', () => {
    expect(transpose('C', -2, true)).toBe('Bb');
  });

  it('preserva a qualidade menor e a extensão (F#m7 -3)', () => {
    expect(transpose('F#m7', -3)).toBe('D#m7'); // sustenidos (padrão)
    expect(transpose('F#m7', -3, true)).toBe('Ebm7'); // bemóis
  });

  it('preserva maj7 (Bbmaj7 +5)', () => {
    expect(transpose('Bbmaj7', 5)).toBe('D#maj7'); // sustenidos (padrão)
    expect(transpose('Bbmaj7', 5, true)).toBe('Ebmaj7'); // bemóis
  });

  it('transpõe slash chords (raiz e baixo) — G/B +1', () => {
    expect(transpose('G/B', 1)).toBe('G#/C');
  });

  it('respeita a preferência por bemóis', () => {
    expect(transpose('C', 1, true)).toBe('Db');
    expect(transpose('C', 1, false)).toBe('C#');
  });

  it('faz wrap-around no ciclo cromático (B +1 = C)', () => {
    expect(transpose('B', 1)).toBe('C');
    expect(transpose('C', -1)).toBe('B');
  });

  it('transpõe +12 e -12 retornando ao mesmo acorde', () => {
    expect(transpose('Am7', 12)).toBe('Am7');
    expect(transpose('Am7', -12)).toBe('Am7');
  });

  it('retorna a string original inalterada para entradas inválidas', () => {
    expect(transpose('xyz', 2)).toBe('xyz');
    expect(transpose('', 2)).toBe('');
  });

  // ── Acordes exigidos pela especificação ─────────────────────────────────
  it.each([
    ['A', 2, false, 'B'],
    ['Am', 3, false, 'Cm'],
    ['A7', 5, false, 'D7'],
    ['Am7', 2, false, 'Bm7'],
    ['Amaj7', 1, false, 'A#maj7'],
    ['Asus4', 2, false, 'Bsus4'],
    ['Aadd9', 2, false, 'Badd9'],
    ['A°', 1, false, 'A#°'],
    ['Aaug', 2, false, 'Baug'],
    ['A#', 1, false, 'B'],
    ['Bb', -1, false, 'A'],
    ['Db', 1, false, 'D'],
    ['F#m7', 2, false, 'G#m7'],
    ['Bm7(b5)', 1, false, 'Cm7(b5)'],
    ['Eb7(#9)', 2, false, 'F7(#9)'],
    ['C/E', 2, false, 'D/F#'],
  ] as const)('transpõe %s por %d semitons → %s', (chord, semi, flats, expected) => {
    expect(transpose(chord, semi, flats)).toBe(expected);
  });
});
