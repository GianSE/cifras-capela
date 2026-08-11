import { describe, it, expect } from 'vitest';
import {
  buildSongId,
  deriveIndexEntry,
  extractLyricsText,
  nextFreeSongId,
} from '../../src/lib/library/derive';

const SOURCE = `---
title: Mãos ao Alto
artist: Domínio Público
key: D
tempo: 72
categories: [culto, santa ceia]
tags: [adoração]
language: pt
---

{verso 1}
[D]Ergo minhas mãos ao [G]alto,
[A]entrego a Ti meu [D]coração.
`;

describe('buildSongId', () => {
  it('monta o id a partir da 1ª categoria e do título', () => {
    expect(buildSongId('Mãos ao Alto', ['culto', 'santa ceia'])).toBe('culto/maos-ao-alto');
  });

  it('remove acentos e normaliza para slug', () => {
    expect(buildSongId('Porque Ele Vive!', ['Harpa Cristã'])).toBe(
      'harpa-crista/porque-ele-vive',
    );
  });

  it('usa "geral" quando não há categoria', () => {
    expect(buildSongId('Sem Categoria')).toBe('geral/sem-categoria');
  });

  it('tem fallback para título vazio', () => {
    expect(buildSongId('')).toBe('geral/sem-titulo');
  });
});

describe('extractLyricsText', () => {
  it('remove frontmatter, seções e acordes, deixando só a letra', () => {
    const lyrics = extractLyricsText(SOURCE);

    expect(lyrics).toContain('Ergo minhas mãos ao alto');
    expect(lyrics).toContain('entrego a Ti meu coração');
    // Nada de metadados, diretivas ou acordes.
    expect(lyrics).not.toContain('title');
    expect(lyrics).not.toContain('verso');
    expect(lyrics).not.toContain('[');
    expect(lyrics).not.toContain('D');
  });
});

describe('deriveIndexEntry', () => {
  it('deriva todos os metadados do .cho', () => {
    const entry = deriveIndexEntry('culto/maos-ao-alto', SOURCE);

    expect(entry.id).toBe('culto/maos-ao-alto');
    expect(entry.title).toBe('Mãos ao Alto');
    expect(entry.artist).toBe('Domínio Público');
    expect(entry.key).toBe('D');
    expect(entry.tempo).toBe(72);
    expect(entry.categories).toEqual(['culto', 'santa ceia']);
    expect(entry.tags).toEqual(['adoração']);
    expect(entry.language).toBe('pt');
    expect(entry.filename).toBe('maos-ao-alto.cho');
    expect(entry.lyrics).toContain('Ergo minhas mãos');
  });

  it('usa o id como título quando o frontmatter não tem um', () => {
    const entry = deriveIndexEntry('culto/sem-titulo', '[G]Só a letra\n');
    expect(entry.title).toBe('sem titulo');
  });

  it('omite campos ausentes em vez de gravar vazios', () => {
    const entry = deriveIndexEntry('geral/x', `---\ntitle: X\n---\n[G]Oi\n`);

    expect(entry.artist).toBeUndefined();
    expect(entry.categories).toBeUndefined();
    expect(entry.tags).toBeUndefined();
    expect(entry.tempo).toBeUndefined();
  });
});

describe('nextFreeSongId', () => {
  it('devolve o próprio id quando ninguém o ocupa', () => {
    expect(nextFreeSongId('culto/amem', [])).toBe('culto/amem');
    expect(nextFreeSongId('culto/amem', ['culto/outra'])).toBe('culto/amem');
  });

  it('sufixa a partir de 2 quando o id está ocupado', () => {
    expect(nextFreeSongId('culto/amem', ['culto/amem'])).toBe('culto/amem-2');
  });

  it('pula os sufixos já usados', () => {
    const taken = ['culto/amem', 'culto/amem-2', 'culto/amem-3'];
    expect(nextFreeSongId('culto/amem', taken)).toBe('culto/amem-4');
  });

  it('não se confunde com um id que apenas começa igual', () => {
    // "culto/amem-glória" não ocupa a vaga de "culto/amem".
    expect(nextFreeSongId('culto/amem', ['culto/amem-gloria'])).toBe('culto/amem');
  });
});
