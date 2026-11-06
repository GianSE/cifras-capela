/**
 * @module lib/scan-images
 * @description Mostrar a folha como música: a foto ou as páginas do PDF.
 *
 * O tipo vem do próprio arquivo, e não do cadastro da folha: quem só lê pode ver
 * a foto de uma música, mas não a lista de folhas. O pdf.js e os canvas só são
 * carregados quando alguém abre uma folha.
 */

import { scanFileUrl } from '@/lib/scans';

/** Uma página pronta para ir ao PDF da playlist. */
export interface ScanPageImage {
  readonly data: string;
  readonly width: number;
  readonly height: number;
}

/** Lado maior no PDF: mais que isso só pesa no arquivo, sem melhorar a leitura. */
const PDF_MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;
/** Página de PDF na tela: nítida o bastante para ampliar sem borrar a cifra. */
const PDF_PAGE_SCALE = 2;

async function fetchScan(scanId: string): Promise<Blob> {
  const res = await fetch(scanFileUrl(scanId), { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`A folha respondeu ${res.status}`);
  return res.blob();
}

const isPdf = (blob: Blob) => blob.type === 'application/pdf';

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponível.');
  return { canvas, context };
}

async function renderPdfPages(blob: Blob): Promise<ScanPageImage[]> {
  const { renderPdfToImages } = await import('@/lib/pdf-render');
  return renderPdfToImages(await blob.arrayBuffer(), {
    scale: PDF_PAGE_SCALE,
    quality: JPEG_QUALITY,
  });
}

/**
 * Os endereços para mostrar na tela. A foto vai como está, para ampliar sem perder
 * nada; o PDF vira imagens, porque embutido ele não abre no celular.
 *
 * `release` libera a memória quando a tela sai.
 */
export async function loadScanForView(
  scanId: string,
): Promise<{ urls: string[]; release: () => void }> {
  const blob = await fetchScan(scanId);
  if (isPdf(blob)) {
    const pages = await renderPdfPages(blob);
    return { urls: pages.map((p) => p.data), release: () => {} };
  }
  const url = URL.createObjectURL(blob);
  return { urls: [url], release: () => URL.revokeObjectURL(url) };
}

/** As páginas em JPEG, para embutir no PDF da música ou da playlist. */
export async function loadScanForPdf(scanId: string): Promise<ScanPageImage[]> {
  const blob = await fetchScan(scanId);
  if (isPdf(blob)) return renderPdfPages(blob);

  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, PDF_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const { canvas, context } = canvasOf(bitmap.width * scale, bitmap.height * scale);
    // Fundo branco: PNG com transparência viraria preto no JPEG.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return [
      {
        data: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
        width: canvas.width,
        height: canvas.height,
      },
    ];
  } finally {
    bitmap.close();
  }
}
