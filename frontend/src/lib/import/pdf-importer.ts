/**
 * @module lib/import/pdf-importer
 * @description Extrai texto de um PDF **local** do usuário (via pdf.js),
 * reconstruindo o layout por posição (para preservar acordes acima da letra),
 * e reaproveita o importador de texto. Carregado sob demanda (code-split).
 */
import { importPlainText } from './text-importer';
import type { ImportedSong } from './types';

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
}

/** Reconstrói uma linha de texto a partir de itens posicionados (x, largura). */
function itemsToLine(items: TextItemLike[], charWidth: number, minX: number): string {
  const sorted = [...items].sort((a, b) => a.transform[4]! - b.transform[4]!);
  let line = '';
  for (const item of sorted) {
    const col = Math.max(0, Math.round((item.transform[4]! - minX) / charWidth));
    if (line.length < col) line = line.padEnd(col, ' ');
    line += item.str;
  }
  return line.replace(/\s+$/, '');
}

/** Extrai o texto de todo o PDF preservando quebras/colunas aproximadas. */
async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: TextItemLike[] = (content.items as unknown as Array<Record<string, unknown>>)
      .filter((it) => typeof it['str'] === 'string' && Array.isArray(it['transform']))
      .map((it) => ({
        str: it['str'] as string,
        transform: it['transform'] as number[],
        width: typeof it['width'] === 'number' ? (it['width'] as number) : 0,
      }));

    // Estima a largura média de um caractere.
    const widths = items
      .filter((it) => it.str.length > 0)
      .map((it) => it.width / it.str.length)
      .filter((w) => w > 0);
    const charWidth = widths.length > 0 ? median(widths) : 5;
    const minX = Math.min(...items.map((it) => it.transform[4]!), 0);

    // Agrupa por linha (y arredondado).
    const byLine = new Map<number, TextItemLike[]>();
    for (const item of items) {
      const y = Math.round(item.transform[5]!);
      const bucket = byLine.get(y) ?? [];
      bucket.push(item);
      byLine.set(y, bucket);
    }

    const lines = [...byLine.entries()]
      .sort((a, b) => b[0] - a[0]) // y decrescente = de cima para baixo
      .map(([, group]) => itemsToLine(group, charWidth, minX));

    pages.push(lines.join('\n'));
  }

  return pages.join('\n\n');
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export async function importPdf(data: ArrayBuffer): Promise<ImportedSong> {
  try {
    const text = await extractPdfText(data);
    const result = importPlainText(text);
    return {
      ...result,
      warnings: [...result.warnings, 'PDF importado por heurística — revise o alinhamento.'],
    };
  } catch {
    return { body: '', warnings: ['Não foi possível ler o PDF.'] };
  }
}
