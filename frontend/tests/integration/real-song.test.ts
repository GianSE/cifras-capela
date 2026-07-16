import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../../src/lib/parser';
import { transposeSong } from '../../src/lib/transpose';
import type { Song } from '../../src/types/song';

/**
 * Verificação end-to-end sobre um arquivo de música REAL da biblioteca.
 *
 * Garante o requisito central da especificação: ao transpor, **todos** os
 * acordes mudam e a **letra permanece exatamente igual**.
 */

const SONGS_DIR = path.resolve(__dirname, '../../public/songs');

function readSong(relative: string): string {
  return fs.readFileSync(path.join(SONGS_DIR, relative), 'utf-8');
}

/** Extrai a letra concatenada, na ordem, ignorando acordes. */
function lyricsOf(song: Song): string {
  return song.sections
    .flatMap((s) => s.lines.map((l) => l.segments.map((seg) => seg.lyric).join('')))
    .join('\n');
}

/** Extrai todos os acordes (raw), na ordem. */
function chordsOf(song: Song): string[] {
  return song.sections.flatMap((s) =>
    s.lines.flatMap((l) => l.segments.filter((seg) => seg.chord).map((seg) => seg.chord!.raw)),
  );
}

describe('Música real: culto/maos-ao-alto.cho', () => {
  const raw = readSong('culto/maos-ao-alto.cho');
  const { song, errors } = parse(raw);

  it('parseia sem erros e lê o frontmatter', () => {
    expect(errors).toHaveLength(0);
    expect(song.metadata.title).toBe('Mãos ao Alto');
    expect(song.metadata.key).toBe('D');
    expect(song.metadata.tempo).toBe(72);
    expect(song.metadata.categories).toEqual(['culto', 'santa ceia']);
  });

  it('reconhece as seções amigáveis do corpo', () => {
    const types = song.sections.filter((s) => s.type !== 'none').map((s) => s.type);
    expect(types).toEqual(['verse', 'bridge', 'chorus']);
  });

  it('reconhece TODOS os acordes do arquivo (nenhum vira texto literal)', () => {
    const chords = chordsOf(song);
    expect(chords.length).toBeGreaterThan(0);
    expect(new Set(chords)).toEqual(new Set(['D', 'G', 'A', 'Bm']));
    // Nenhum acorde caiu no fallback "[X]" como letra
    expect(lyricsOf(song)).not.toContain('[');
  });

  it('ao transpor +2, TODOS os acordes mudam e a letra permanece idêntica', () => {
    const transposed = transposeSong(song, 2, false);

    // Letra byte-a-byte idêntica
    expect(lyricsOf(transposed)).toBe(lyricsOf(song));

    // Todos os acordes transpostos corretamente (D→E, G→A, A→B, Bm→C#m)
    const map: Record<string, string> = { D: 'E', G: 'A', A: 'B', Bm: 'C#m' };
    const before = chordsOf(song);
    const after = chordsOf(transposed);
    expect(after).toHaveLength(before.length);
    after.forEach((chord, i) => {
      expect(chord).toBe(map[before[i]!]);
    });

    // A tonalidade dos metadados acompanha
    expect(transposed.metadata.key).toBe('E');
  });

  it('transpor -12/+12 volta ao original (ciclo cromático)', () => {
    expect(chordsOf(transposeSong(song, 12, false))).toEqual(chordsOf(song));
    expect(chordsOf(transposeSong(song, -12, false))).toEqual(chordsOf(song));
  });

  it('respeita a preferência por bemóis sem alterar a letra', () => {
    const flat = transposeSong(song, 1, true);
    expect(lyricsOf(flat)).toBe(lyricsOf(song));
    // D+1 = Eb (bemol) em vez de D#
    expect(chordsOf(flat)).toContain('Eb');
    expect(chordsOf(flat)).not.toContain('D#');
  });

  it('não muta a música original (imutabilidade)', () => {
    const snapshot = JSON.stringify(song);
    transposeSong(song, 5, true);
    expect(JSON.stringify(song)).toBe(snapshot);
  });
});

describe('Toda a biblioteca', () => {
  const files = fs
    .readdirSync(SONGS_DIR, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.cho'))
    .map((d) => path.join(d.parentPath ?? d.path, d.name));

  it('encontra os arquivos de música', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(files)('%s: parseia sem erros e transpõe preservando a letra', (file) => {
    const { song, errors } = parse(fs.readFileSync(file, 'utf-8'));

    expect(errors).toEqual([]);
    expect(song.metadata.title).not.toBe('');

    // Nenhum acorde não reconhecido virou texto literal
    expect(lyricsOf(song)).not.toContain('[');

    // Letra intacta após transpor
    for (const semi of [1, 5, 7, -3]) {
      expect(lyricsOf(transposeSong(song, semi, false))).toBe(lyricsOf(song));
    }
  });
});
