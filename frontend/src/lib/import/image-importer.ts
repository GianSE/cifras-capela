/**
 * @module lib/import/image-importer
 * @description Extrai texto de uma foto/print (JPG/PNG) de uma cifra via OCR
 * local (Tesseract.js — visão computacional, sem IA generativa/rede), reconstruindo
 * o layout por posição das palavras (para preservar acordes acima da letra), e
 * reaproveita o importador de texto. Carregado sob demanda (code-split).
 */
import { importPlainText } from './text-importer';
import type { ImportedSong } from './types';

interface WordBox {
  text: string;
  x: number;
  y: number;
  width: number;
}

/** Reconstrói uma linha de texto a partir de palavras posicionadas (x, largura). */
function wordsToLine(words: WordBox[], charWidth: number, minX: number): string {
  const sorted = [...words].sort((a, b) => a.x - b.x);
  let line = '';
  for (const word of sorted) {
    const col = Math.max(0, Math.round((word.x - minX) / charWidth));
    if (line.length < col) line = line.padEnd(col, ' ');
    line += (line.length > col ? ' ' : '') + word.text;
  }
  return line.replace(/\s+$/, '');
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Reconhece o texto da imagem e reconstrói as linhas preservando colunas. */
async function extractImageText(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por', undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });

  try {
    // Pede a hierarquia completa (blocos → parágrafos → linhas → palavras) —
    // por padrão o Tesseract.js só devolve o texto puro, sem posição.
    const { data } = await worker.recognize(file, {}, { blocks: true, text: true });

    const boxes: WordBox[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          for (const word of line.words ?? []) {
            if (!word.text.trim()) continue;
            boxes.push({
              text: word.text,
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
            });
          }
        }
      }
    }

    if (boxes.length === 0) return data.text ?? '';

    // Estima a largura média de um caractere (para converter posição x → coluna).
    const widths = boxes.map((w) => w.width / Math.max(1, w.text.length)).filter((w) => w > 0);
    const charWidth = widths.length > 0 ? median(widths) : 8;
    const minX = Math.min(...boxes.map((w) => w.x), 0);

    // Agrupa por linha: palavras cujo topo (y) cai dentro da mesma faixa,
    // usando a altura média de uma linha como tolerância.
    const lineHeight = Math.max(10, median(boxes.map((w) => w.width)) * 1.4);
    const sortedByY = [...boxes].sort((a, b) => a.y - b.y);
    const lines: WordBox[][] = [];
    for (const word of sortedByY) {
      const last = lines.at(-1);
      const lastY = last?.[0]?.y;
      if (last && lastY !== undefined && Math.abs(word.y - lastY) < lineHeight / 2) {
        last.push(word);
      } else {
        lines.push([word]);
      }
    }

    return lines.map((group) => wordsToLine(group, charWidth, minX)).join('\n');
  } finally {
    await worker.terminate();
  }
}

export async function importImage(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<ImportedSong> {
  try {
    const text = await extractImageText(file, onProgress);
    if (!text.trim()) {
      return { body: '', warnings: ['Não foi possível reconhecer texto na imagem.'] };
    }
    const result = importPlainText(text);
    return {
      ...result,
      warnings: [...result.warnings, 'Imagem importada por OCR — revise o alinhamento.'],
    };
  } catch {
    return { body: '', warnings: ['Não foi possível processar a imagem.'] };
  }
}
