/**
 * @module lib/import
 * @description Ponto de entrada dos importadores. Detecta o formato e delega
 * para o importador adequado, produzindo um {@link ImportedSong} para revisão.
 */
import { parse, serializeToFrontmatter } from '@/lib/parser';
import { importPlainText } from './text-importer';

export { splitPastedSongs } from './text-importer';
import { importHtml } from './html-importer';
import { importMarkdown } from './markdown-importer';
import { importJson } from './json-importer';
import { importPdf } from './pdf-importer';
import type { ImportedSong } from './types';

export type { ImportedSong } from './types';

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** Importa a partir de texto colado, com o formato informado. */
export function importFromText(text: string, format: string): ImportedSong {
  switch (format) {
    case 'json':
      return importJson(text);
    case 'html':
      return importHtml(text);
    case 'md':
    case 'markdown':
      return importMarkdown(text);
    case 'cho':
    case 'chordpro':
      return importChordPro(text);
    default:
      return importPlainText(text);
  }
}

/** Importa um arquivo selecionado pelo usuário. */
export async function importFile(file: File): Promise<ImportedSong> {
  const ext = extensionOf(file.name);
  if (ext === 'pdf') {
    return importPdf(await file.arrayBuffer());
  }
  return importFromText(await file.text(), ext);
}

/** ChordPro/`.cho`: normaliza para o formato de autoria e extrai metadados. */
function importChordPro(text: string): ImportedSong {
  if (/^---\r?\n/.test(text)) return importMarkdown(text);
  const { song } = parse(text);
  return importMarkdown(serializeToFrontmatter(song));
}

/** Monta o texto-fonte (frontmatter + corpo) a partir de uma música importada. */
export function buildSource(s: ImportedSong): string {
  const fm: string[] = ['---', `title: ${s.title ?? ''}`, `artist: ${s.artist ?? ''}`];
  if (s.key) fm.push(`key: ${s.key}`);
  if (s.tempo !== undefined) fm.push(`tempo: ${s.tempo}`);
  if (s.capo !== undefined) fm.push(`capo: ${s.capo}`);
  fm.push(`categories: [${(s.categories ?? []).join(', ')}]`);
  fm.push(`tags: [${(s.tags ?? []).join(', ')}]`);
  fm.push(`language: ${s.language ?? 'pt'}`);
  fm.push('---', '');
  return `${fm.join('\n')}\n${s.body}\n`;
}
