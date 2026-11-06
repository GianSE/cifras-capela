/**
 * @module lib/pdf-render
 * @description Desenha as páginas de um PDF como imagens, com o pdf.js.
 *
 * Serve à prévia do PDF da playlist e às folhas guardadas em PDF: PDF embutido não
 * abre no celular, imagem abre em qualquer lugar. Carregado sob demanda.
 */

export interface RenderedPage {
  readonly data: string;
  readonly width: number;
  readonly height: number;
}

export async function renderPdfToImages(
  data: ArrayBuffer,
  { scale = 2, quality = 0.85 }: { scale?: number; quality?: number } = {},
): Promise<RenderedPage[]> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  // O pdf.js toma posse dos bytes que recebe: vai uma cópia, e o original fica
  // inteiro para quem chamou (a prévia baixa exatamente o que mostrou).
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  try {
    const pages: RenderedPage[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas indisponível.');
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push({
        data: canvas.toDataURL('image/jpeg', quality),
        width: canvas.width,
        height: canvas.height,
      });
    }
    return pages;
  } finally {
    void doc.destroy();
  }
}
