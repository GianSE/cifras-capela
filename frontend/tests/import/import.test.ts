import { describe, it, expect } from 'vitest';
import { isChordLine } from '../../src/lib/import/chord-detection';
import { mergeChordLine } from '../../src/lib/import/positional';
import { importPlainText } from '../../src/lib/import/text-importer';
import { importFromText } from '../../src/lib/import';

describe('detecção de acordes', () => {
  it('reconhece linha só de acordes', () => {
    expect(isChordLine('G       C   D')).toBe(true);
    expect(isChordLine('Am   Dm7   E7')).toBe(true);
  });

  it('não trata letra como linha de acordes', () => {
    expect(isChordLine('Porque Ele vive hoje')).toBe(false);
  });

  it('ignora linhas com acordes inline', () => {
    expect(isChordLine('[G]Porque Ele [C]vive')).toBe(false);
  });
});

describe('fusão posicional (acordes acima da letra)', () => {
  it('insere acordes inline preservando a letra', () => {
    const merged = mergeChordLine('    G       C', 'Porque Ele vive');
    expect(merged).toContain('[G]');
    expect(merged).toContain('[C]');
    // Removendo os acordes, a letra original é preservada.
    expect(merged.replace(/\[[^\]]+\]/g, '')).toBe('Porque Ele vive');
  });
});

describe('importação de texto', () => {
  it('converte bloco de acordes-sobre-letra em inline', () => {
    const raw = ['Tom: G', '', 'G           C', 'Porque Ele vive'].join('\n');
    const result = importPlainText(raw);
    expect(result.key).toBe('G');
    expect(result.body).toContain('[G]');
    expect(result.body).toContain('[C]');
  });
});

describe('importação de JSON', () => {
  it('mapeia campos comuns', () => {
    const json = JSON.stringify({
      title: 'Exemplo',
      artist: 'Autor',
      tom: 'D',
      body: '[D]Linha de teste',
    });
    const result = importFromText(json, 'json');
    expect(result.title).toBe('Exemplo');
    expect(result.artist).toBe('Autor');
    expect(result.key).toBe('D');
    expect(result.body).toContain('[D]');
  });
});
