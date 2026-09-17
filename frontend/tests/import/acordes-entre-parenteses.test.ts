import { describe, it, expect } from 'vitest';
import { isChordLine } from '../../src/lib/import/chord-detection';
import { importPlainText } from '../../src/lib/import/text-importer';

/**
 * O CifraClub escreve os trechos instrumentais entre parênteses:
 * `( Dm7  Bb  F  C )`. Sem reconhecê-los como acordes eles ficavam como
 * texto — e continuavam no tom original quando a música era transposta.
 */
describe('acordes entre parênteses', () => {
  it.each([
    '( Dm7  Bb  F  C )',
    '(Bb  C/Bb  F)',
    '( F4  F  Dm7 )',
  ])('"%s" é linha de acordes', (linha) => {
    expect(isChordLine(linha)).toBe(true);
  });

  it('vira acordes de verdade, que a transposição alcança', () => {
    const body = importPlainText('[Solo]\n( Dm7  Bb  F  C )\n(Bb  C/Bb  F)').body;
    expect(body).toContain('[Dm7] [Bb] [F] [C]');
    expect(body).toContain('[Bb] [C/Bb] [F]');
  });

  it('preserva os parênteses que fazem parte do acorde', () => {
    // G6(9) tem parênteses próprios; a primeira versão da correção os comia.
    expect(isChordLine('D2  D9/F#  G6(9)')).toBe(true);
    expect(importPlainText('[Solo]\n( D2  G6(9) )').body).toContain('[D2] [G6(9)]');
    expect(importPlainText('[Solo]\n(G6(9))').body).toContain('[G6(9)]');
  });

  it('não confunde letra com parênteses com linha de acordes', () => {
    expect(isChordLine('(Aleluia, aleluia)')).toBe(false);
    expect(isChordLine('Eu (E) você')).toBe(false);
  });
});
