/**
 * @module lib/library/derive
 * @description Deriva os metadados de busca a partir do `.cho`.
 *
 * O `source` é sempre a fonte da verdade; título, tom, categorias e a letra
 * pura são **derivados** dele. Isso evita que os metadados divirjam do arquivo
 * — ao salvar, tudo é recalculado a partir do texto.
 */

import { parse } from '@/lib/parser';
import type { SongIndexEntry } from '@/types/library';
import type { Song } from '@/types/song';

/**
 * Extrai a letra em texto puro (sem frontmatter, diretivas nem acordes),
 * usada apenas para indexar a busca por trechos.
 */
export function extractLyricsText(source: string): string {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  return body
    .replace(/\{[^}]*\}/g, ' ') // diretivas / seções
    .replace(/\[[^\]]*\]/g, '') // acordes
    .replace(/^#.*$/gm, ' ') // comentários
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nome de arquivo a partir do id (`culto/nova` → `nova.cho`). */
export function filenameFromId(id: string): string {
  return `${id.split('/').pop() ?? id}.cho`;
}

/**
 * Monta a entrada de índice (usada na biblioteca e na busca) a partir do
 * `.cho`, opcionalmente reaproveitando uma AST já parseada.
 */
export function deriveIndexEntry(id: string, source: string, parsed?: Song): SongIndexEntry {
  const song = parsed ?? parse(source).song;
  const m = song.metadata;
  const lyrics = extractLyricsText(source);

  return {
    id,
    title: m.title || (id.split('/').pop() ?? id).replace(/-/g, ' '),
    filename: filenameFromId(id),
    ...(m.artist && { artist: m.artist }),
    ...(m.key && { key: m.key }),
    ...(m.categories && m.categories.length > 0 && { categories: [...m.categories] }),
    ...(m.tags && m.tags.length > 0 && { tags: [...m.tags] }),
    ...(m.language && { language: m.language }),
    ...(m.tempo !== undefined && { tempo: m.tempo }),
    ...(lyrics && { lyrics }),
  };
}

/**
 * Gera um id no formato `categoria/slug` a partir do título e da 1ª categoria.
 * É o mesmo formato dos arquivos versionados (`harpa-crista/porque-ele-vive`).
 */
export function buildSongId(title: string, categories: readonly string[] = []): string {
  const slug = (text: string): string =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

  const folder = slug(categories[0] ?? 'geral') || 'geral';
  const name = slug(title) || 'sem-titulo';
  return `${folder}/${name}`;
}
