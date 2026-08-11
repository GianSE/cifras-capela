import { describe, it, expect, beforeEach } from 'vitest';
import { SearchEngine } from '../../src/lib/search/search-engine';
import type { SongIndexEntry } from '../../src/types/library';

const SONGS = [
  {
    id: 'culto/coracao-aberto',
    title: 'Coração Aberto',
    artist: 'Comunidade Católica Shalom',
    categories: ['comunhão'],
    lyrics: 'guardo a paz aqui no coração',
  },
  {
    id: 'amem/amem',
    title: 'Amém',
    artist: 'Domínio Público',
    categories: ['amém'],
    lyrics: 'louvação e ação de graças',
  },
  {
    id: 'culto/tu-es-fiel',
    title: 'Tu És Fiel',
    artist: 'Não Informado',
    categories: ['adoração'],
    lyrics: 'a tua misericórdia não tem fim',
  },
] as unknown as SongIndexEntry[];

describe('SearchEngine', () => {
  let engine: SearchEngine;

  beforeEach(() => {
    engine = new SearchEngine();
    engine.init(SONGS);
  });

  const titles = (query: string) => engine.search(query).map((s) => s.title);

  describe('busca sem acento', () => {
    // No celular quase ninguém digita acento; escrever sem ele tem de achar.
    it.each([
      ['coracao', 'Coração Aberto'],
      ['coração', 'Coração Aberto'],
      ['CORACAO', 'Coração Aberto'],
      ['amem', 'Amém'],
      ['es fiel', 'Tu És Fiel'],
    ])('"%s" encontra "%s"', (query, expected) => {
      expect(titles(query)).toContain(expected);
    });

    it('acha pela letra sem acento (cedilha vira "c")', () => {
      expect(titles('louvacao')).toContain('Amém');
      expect(titles('misericordia')).toContain('Tu És Fiel');
    });

    it('acha pelo artista e pela categoria sem acento', () => {
      expect(titles('catolica')).toContain('Coração Aberto');
      expect(titles('adoracao')).toContain('Tu És Fiel');
    });
  });

  it('busca vazia não devolve nada (a lista completa é do chamador)', () => {
    expect(engine.search('')).toHaveLength(0);
    expect(engine.search('   ')).toHaveLength(0);
  });

  it('reindexa ao ser reinicializado, sem deixar sobras', () => {
    engine.init([SONGS[0]!]);
    expect(titles('amem')).toHaveLength(0);
    expect(titles('coracao')).toContain('Coração Aberto');
  });
});
