/**
 * @module lib/import
 * @description Ponto de entrada dos importadores. Detecta o formato e delega
 * para o importador adequado, produzindo um {@link ImportedSong} para revisão.
 */
import { parse, serializeToFrontmatter } from '@/lib/parser';
import { importMarkdown } from './markdown-importer';
import { importPdf } from './pdf-importer';
import { importImage } from './image-importer';
import type { ImportedSong } from './types';

export type { ImportedSong } from './types';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);

/** O que o seletor de arquivo aceita: PDF, foto (JPG/PNG) e `.cho`. */
export const ACCEPTED_FILE_TYPES = '.pdf,.cho,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** Importa um arquivo selecionado pelo usuário. */
export async function importFile(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<ImportedSong> {
  const ext = extensionOf(file.name);
  if (ext === 'pdf') {
    return importPdf(await file.arrayBuffer());
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return importImageWithFallback(file, onProgress);
  }
  if (ext === 'cho') {
    return importChordPro(await file.text());
  }
  throw new Error('Formato não aceito. Escolha um arquivo .pdf, .cho, .jpg ou .png.');
}

/**
 * Importa a imagem por OCR (Tesseract, no próprio aparelho). Quando não acha
 * nenhum acorde — sinal de que o alinhamento da foto bagunçou o texto —, avisa
 * em vez de fingir que deu certo: o texto vem cru para ser ajustado na revisão.
 */
async function importImageWithFallback(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<ImportedSong> {
  const result = await importImage(file, onProgress);
  if (result.body.includes('[')) return result;
  return {
    ...result,
    warnings: [
      ...result.warnings,
      'Nenhum acorde reconhecido na foto — ajuste a cifra no campo abaixo.',
    ],
  };
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
  if (s.youtube) fm.push(`youtube: ${s.youtube}`);
  fm.push('---', '');
  return `${fm.join('\n')}\n${s.body}\n`;
}
