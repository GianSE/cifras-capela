/**
 * @module lib/import/markdown-importer
 * @description Importa Markdown. Se houver frontmatter YAML, aproveita-o; senão
 * remove marcadores de formatação e reaproveita o importador de texto.
 */
import { parse } from '@/lib/parser';
import { importPlainText } from './text-importer';
import type { ImportedSong } from './types';

/** Remove marcadores comuns de Markdown que não fazem parte da cifra. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '') // títulos
    .replace(/\*\*(.+?)\*\*/g, '$1') // negrito
    .replace(/\*(.+?)\*/g, '$1') // itálico
    .replace(/^>\s?/gm, '') // citações
    .replace(/^[-*+]\s+/gm, ''); // listas
}

export function importMarkdown(md: string): ImportedSong {
  // Já no formato híbrido (frontmatter)? Extrai metadados via parser do núcleo.
  if (/^---\r?\n/.test(md)) {
    const { song } = parse(md);
    const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    return {
      title: song.metadata.title || undefined,
      artist: song.metadata.artist,
      key: song.metadata.key,
      categories: song.metadata.categories ? [...song.metadata.categories] : undefined,
      tags: song.metadata.tags ? [...song.metadata.tags] : undefined,
      language: song.metadata.language,
      tempo: song.metadata.tempo,
      capo: song.metadata.capo,
      body: body.trim(),
      warnings: [],
    };
  }

  return importPlainText(stripMarkdown(md));
}
