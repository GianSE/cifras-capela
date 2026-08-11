/**
 * @module lib/import/url-importer
 * @description Importa a cifra a partir do endereço de uma página.
 *
 * O navegador não consegue buscar outro site (CORS), então quem baixa a
 * página é o Worker, em `/api/fetch-page`. Daqui para a frente o caminho é o
 * mesmo do arquivo `.html`: o `html-importer` acha o bloco `<pre>` que os
 * sites de cifra usam e lê acordes e letra de lá.
 */

import { importHtml } from './html-importer';
import type { ImportedSong } from './types';

/** `true` quando o Worker que busca páginas está disponível. */
export async function isUrlImportAvailable(): Promise<boolean> {
  try {
    // O endpoint só aceita POST; um GET responde 405 e já prova que existe.
    const res = await fetch('/api/fetch-page', { method: 'GET' });
    return res.status !== 404 && res.status !== 501;
  } catch {
    return false;
  }
}

export async function importFromUrl(url: string): Promise<ImportedSong> {
  const res = await fetch('/api/fetch-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = (await res.json().catch(() => ({}))) as { html?: string; error?: string };
  if (!res.ok || typeof data.html !== 'string') {
    throw new Error(data.error ?? 'Não foi possível ler essa página.');
  }

  const imported = importHtml(data.html);
  if (!imported.body.trim()) {
    throw new Error(
      'A página abriu, mas não encontrei a cifra nela. Tente copiar e colar o texto.',
    );
  }

  return {
    ...imported,
    warnings: [...imported.warnings, `Importada de ${new URL(url).hostname}. Confira antes de salvar.`],
  };
}
