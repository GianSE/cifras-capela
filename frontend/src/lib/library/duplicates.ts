/**
 * @module lib/library/duplicates
 * @description Acha músicas da biblioteca parecidas com a que está entrando.
 *
 * O id (`categoria/titulo`) não serve para isso: a mesma música importada como
 * "Comunhão" e depois como "Final" tem ids diferentes. Aqui se compara o que a
 * música é — o título e a letra — e o resultado só serve para **avisar**: há
 * vários "Santo" diferentes com o mesmo texto, e quem decide é a pessoa.
 */

import type { SongIndexEntry } from '@/types/library';

export interface DuplicateMatch {
  readonly song: SongIndexEntry;
  readonly sameTitle: boolean;
  readonly similarLyrics: boolean;
}

/** Sequências de palavras comparadas: 3 evita casar só por palavras comuns. */
const SHINGLE_WORDS = 3;
/** Letra curta demais (ou só o título repetido) não permite concluir nada. */
const MIN_SHINGLES = 12;
/** Parte da letra menor que precisa aparecer na outra. */
const SIMILAR_LYRICS = 0.6;

/** Sem acentos, em minúsculas e só com letras e números, separados por espaço. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Título comparável: tira o que costuma variar entre sites, como "(Ao vivo)",
 * "[Versão 2]" e o intérprete depois de um travessão.
 */
export function normalizeTitle(title: string): string {
  const [main = ''] = title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(/\s[-–—]\s/);
  return normalizeText(main);
}

function shingles(text: string): Set<string> {
  const words = normalizeText(text).split(' ').filter(Boolean);
  const result = new Set<string>();
  for (let i = 0; i + SHINGLE_WORDS <= words.length; i++) {
    result.add(words.slice(i, i + SHINGLE_WORDS).join(' '));
  }
  return result;
}

/**
 * Mede sobre a letra **menor**: uma versão com um verso a mais continua sendo a
 * mesma música, e o refrão repetido não pesa porque cada trecho conta uma vez.
 */
function lyricsAreSimilar(a: Set<string>, b: Set<string>): boolean {
  if (a.size < MIN_SHINGLES || b.size < MIN_SHINGLES) return false;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const shingle of small) if (large.has(shingle)) shared++;
  return shared / small.size >= SIMILAR_LYRICS;
}

/**
 * Músicas parecidas com o rascunho, as mais prováveis primeiro: título e letra
 * batendo, depois só a letra e, por fim, só o título (o sinal mais fraco).
 */
export function findDuplicates(
  draft: { readonly title: string; readonly lyrics?: string },
  songs: readonly SongIndexEntry[],
): DuplicateMatch[] {
  const title = normalizeTitle(draft.title);
  const lyrics = shingles(draft.lyrics ?? '');

  const score = (m: DuplicateMatch) => (m.similarLyrics ? 2 : 0) + (m.sameTitle ? 1 : 0);

  return songs
    .map((song) => ({
      song,
      sameTitle: title !== '' && normalizeTitle(song.title) === title,
      similarLyrics: lyricsAreSimilar(lyrics, shingles(song.lyrics ?? '')),
    }))
    .filter((m) => m.sameTitle || m.similarLyrics)
    .sort((a, b) => score(b) - score(a));
}
