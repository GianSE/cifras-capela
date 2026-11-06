/**
 * @module lib/scans
 * @description Folhas: fotos e PDFs de cifra guardados no servidor (R2) para
 * transcrever depois — conversa com `/api/scans`.
 *
 * Fluxo: fotografar/enviar (só guarda) → "Transcrever" (IA no servidor, ou o
 * OCR do aparelho quando não há IA) → revisar e confirmar → a folha fica
 * ligada à música como cópia do original.
 */

import { importFile, type ImportedSong } from '@/lib/import';
import { importPlainText } from '@/lib/import/text-importer';

export interface Scan {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  readonly status: 'pendente' | 'validada';
  /** Música gerada a partir desta folha (depois de validada). */
  readonly songId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** O que o seletor de "Enviar arquivo" aceita. */
export const SCAN_ACCEPT = 'image/*,application/pdf,.heic,.heif';

/** Endereço do arquivo original (serve para `<img>`, abrir em nova aba…). */
export function scanFileUrl(id: string): string {
  return `/api/scans/${encodeURIComponent(id)}/file`;
}

export const isPdfScan = (scan: Pick<Scan, 'contentType'>) =>
  scan.contentType === 'application/pdf';

/** Lê a mensagem de erro da API, com um texto padrão se não houver. */
async function errorFrom(res: Response, fallback: string): Promise<Error> {
  try {
    const data = (await res.json()) as { error?: string };
    return new Error(data.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function listScans(): Promise<{ scans: Scan[]; aiAvailable: boolean }> {
  const res = await fetch('/api/scans', { credentials: 'same-origin' });
  if (!res.ok) throw await errorFrom(res, 'Não foi possível carregar as folhas.');
  return (await res.json()) as { scans: Scan[]; aiAvailable: boolean };
}

export async function getScan(id: string): Promise<{ scan: Scan; aiAvailable: boolean }> {
  const res = await fetch(`/api/scans/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
  if (!res.ok) throw await errorFrom(res, 'Folha não encontrada.');
  return (await res.json()) as { scan: Scan; aiAvailable: boolean };
}

/** Tipo do arquivo, deduzido da extensão quando o navegador não informa (HEIC). */
function contentTypeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'heic' || ext === 'heif') return `image/${ext}`;
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

/** Envia o arquivo como está — é o backup, então não se mexe na qualidade. */
export async function uploadScan(file: File): Promise<Scan> {
  const res = await fetch('/api/scans', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': contentTypeOf(file),
      'X-Filename': encodeURIComponent(file.name || 'folha'),
    },
    body: file,
  });
  if (!res.ok) throw await errorFrom(res, 'Não foi possível enviar o arquivo.');
  return ((await res.json()) as { scan: Scan }).scan;
}

/** Liga a folha à música confirmada (marca como validada). */
export async function markScanValidated(id: string, songId: string): Promise<void> {
  const res = await fetch(`/api/scans/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songId }),
  });
  if (!res.ok) throw await errorFrom(res, 'A música foi salva, mas a folha não foi marcada.');
}

export async function deleteScan(id: string): Promise<void> {
  const res = await fetch(`/api/scans/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok) throw await errorFrom(res, 'Não foi possível excluir a folha.');
}

/* ==========================================================================
   Transcrição
   ========================================================================== */

/** Lado maior da imagem mandada à IA: acima disso ela reduz sozinha e cobra igual. */
const AI_MAX_EDGE = 1568;

/**
 * Reduz a foto para mandar à IA (JPEG, lado maior ≤ 1568px). O original de uma
 * câmera tem 4000px+ e passaria do limite da API.
 */
async function downscaleForAi(blob: Blob): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, AI_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');
    // Fundo branco: PNG com transparência viraria preto no JPEG.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}

/** Por onde saiu o rascunho — a revisão avisa o quanto confiar. */
export type TranscriptionSource = 'ia' | 'ocr';

export interface Transcription {
  readonly song: ImportedSong;
  readonly via: TranscriptionSource;
}

/** Erro "pode tentar o OCR local" (sem IA, IA recusou ou fora do ar). */
class FallbackError extends Error {}

async function transcribeWithAi(scan: Scan, original: Blob): Promise<string> {
  let body: string | undefined;
  if (!isPdfScan(scan)) {
    const { data, mediaType } = await downscaleForAi(original);
    body = JSON.stringify({ image: data, mediaType });
  }

  const res = await fetch(`/api/scans/${encodeURIComponent(scan.id)}/transcribe`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    text?: string;
    truncated?: boolean;
    error?: string;
    fallback?: boolean;
  };
  if (!res.ok || !payload.text) {
    const message = payload.error ?? 'A IA não respondeu.';
    throw payload.fallback === false ? new Error(message) : new FallbackError(message);
  }
  return payload.truncated
    ? `${payload.text}\n\n(?) A transcrição foi cortada — confira o final.`
    : payload.text;
}

/** Extensão que os importadores locais reconhecem. */
function localFileName(scan: Scan): string {
  if (isPdfScan(scan)) return 'folha.pdf';
  return scan.contentType === 'image/png' ? 'folha.png' : 'folha.jpg';
}

/**
 * Gera o rascunho da cifra de uma folha. Tenta a IA do servidor; se ela não
 * estiver disponível ou falhar, usa o OCR/leitor de PDF do próprio aparelho.
 */
export async function transcribeScan(
  scan: Scan,
  { onProgress, useAi = true }: { onProgress?: (fraction: number) => void; useAi?: boolean } = {},
): Promise<Transcription> {
  const res = await fetch(scanFileUrl(scan.id), { credentials: 'same-origin' });
  if (!res.ok) throw await errorFrom(res, 'Não foi possível abrir o arquivo da folha.');
  const original = await res.blob();

  let aiProblem: string | undefined;
  if (useAi) {
    try {
      const text = await transcribeWithAi(scan, original);
      const song = importPlainText(text);
      return {
        via: 'ia',
        song: {
          ...song,
          warnings: [
            'Transcrito por IA a partir da folha — confira acordes e letra com a original.',
            ...song.warnings,
          ],
        },
      };
    } catch (e) {
      if (!(e instanceof FallbackError)) throw e;
      aiProblem = e.message;
    }
  }

  // OCR local. Imagens que o navegador não decodifica (HEIC fora do Safari)
  // também não passam no Tesseract — melhor dizer isso claramente.
  if (/^image\/hei[cf]$/.test(scan.contentType)) {
    throw new Error(
      'Este navegador não consegue ler fotos HEIC. Transcreva pelo iPhone ou configure a IA.',
    );
  }
  const file = new File([original], localFileName(scan), { type: scan.contentType });
  const song = await importFile(file, onProgress);
  return {
    via: 'ocr',
    song: {
      ...song,
      warnings: [
        ...(aiProblem ? [`${aiProblem} Usado o reconhecimento do aparelho.`] : []),
        ...song.warnings,
      ],
    },
  };
}
