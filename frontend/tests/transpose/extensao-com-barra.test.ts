import { describe, it, expect } from 'vitest';
import { parseChordString } from '../../src/lib/transpose/chord-parser';
import { transpose } from '../../src/lib/transpose';
import { findChordPositions, isChordLine } from '../../src/lib/import/chord-detection';
import { importPlainText } from '../../src/lib/import/text-importer';

describe('extensão depois da barra (C7/4, D7/9)', () => {
  it('é extensão, e não baixo', () => {
    const chord = parseChordString('C7/4');
    expect(chord?.root).toBe('C');
    expect(chord?.extensions).toBe('7/4');
    expect(chord?.bass).toBeUndefined();
  });

  it('continua aceitando baixo de verdade, inclusive junto', () => {
    expect(parseChordString('D/F#')?.bass?.root).toBe('F');
    const chord = parseChordString('C7/4/E');
    expect(chord?.extensions).toBe('7/4');
    expect(chord?.bass?.root).toBe('E');
  });

  it('transpõe a raiz sem mexer na extensão', () => {
    expect(transpose('C7/4', 2)).toBe('D7/4');
    expect(transpose('C7/4/E', 2)).toBe('D7/4/F#');
  });

  it('palavra ou barra solta não vira acorde', () => {
    expect(parseChordString('C/')).toBeNull();
    expect(parseChordString('Eu/4')).toBeNull();
  });

  it('a linha curta é de acordes, e nenhum acorde some da linha', () => {
    expect(isChordLine('Gm C7/4')).toBe(true);
    expect(findChordPositions('   Gm    C7/4    C7   F').map((p) => p.chord)).toEqual([
      'Gm',
      'C7/4',
      'C7',
      'F',
    ]);
  });

  it('ao importar, fica sobre a letra e não vira verso', () => {
    const { body } = importPlainText('Gm    C7/4\nPara manifestar sua glória\n');
    expect(body).toContain('[Gm]');
    expect(body).toContain('[C7/4]');
    expect(body).not.toMatch(/^Gm C7\/4$/m);
  });
});
