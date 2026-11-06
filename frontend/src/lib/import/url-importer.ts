/**
 * @module lib/import/url-importer
 * @description Importa a cifra a partir do endereço de uma página.
 *
 * O navegador não consegue buscar outro site (CORS), então quem baixa a
 * página é o Worker, em `/api/fetch-page`. Daqui para a frente o caminho é o
 * mesmo do arquivo `.html`: o `html-importer` acha o bloco `<pre>` que os
 * sites de cifra usam e lê acordes e letra de lá.
 *
 * Alguns sites recusam qualquer leitura automática (o CifraClub responde 403).
 * Aí o caminho é a pessoa copiar a cifra no site e colar: `importPastedText`.
 */

import { importHtml } from './html-importer';
import { DEDUCED_TITLE_WARNING, importPlainText } from './text-importer';
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

/** Nome legível do site, para as mensagens. */
export function siteNameOf(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'site';
  }
  if (host.endsWith('cifraclub.com.br')) return 'CifraClub';
  if (host.endsWith('musicasparamissa.com.br')) return 'Músicas para Missa';
  if (host.endsWith('cifrascatolicas.com.br')) return 'Cifras Católicas';
  return host;
}

export async function importFromUrl(url: string): Promise<ImportedSong> {
  const res = await fetch('/api/fetch-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = (await res.json().catch(() => ({}))) as { html?: string; error?: string };
  if (!res.ok || typeof data.html !== 'string') {
    // 403 é o site recusando leitura automática, e não falha do app nem do link.
    if (/\b403\b/.test(data.error ?? '')) {
      throw new Error(
        `O ${siteNameOf(url)} não deixa o app ler a página (403). Copie a cifra no site e cole aqui.`,
      );
    }
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
    warnings: [
      ...imported.warnings,
      `Importada de ${new URL(url).hostname}. Confira antes de salvar.`,
    ],
  };
}

export interface PageHint {
  readonly title?: string;
  readonly artist?: string;
}

const fromSlug = (slug: string | undefined): string | undefined => {
  if (!slug) return undefined;
  let text = slug;
  try {
    text = decodeURIComponent(slug);
  } catch {
    // Fica como veio.
  }
  text = text.replace(/-+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : undefined;
};

/**
 * Título e artista que o endereço deixa ver: `/artista/musica/` no CifraClub e no
 * Cifras Católicas, `/musica/<nome>/` no Músicas para Missa. Sem acentos: é só um
 * ponto de partida para a revisão.
 */
export function hintFromUrl(url: string): PageHint {
  let segments: string[] = [];
  try {
    segments = new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    return {};
  }
  if (segments[0] === 'musica') return { ...(segments[1] && { title: fromSlug(segments[1])! }) };
  const [artist, title] = segments.length >= 2 ? segments.slice(-2) : [undefined, segments[0]];
  return {
    ...(fromSlug(title) && { title: fromSlug(title)! }),
    ...(fromSlug(artist) && { artist: fromSlug(artist)! }),
  };
}

/**
 * A cifra copiada do site. Título e artista vêm do que se sabe da página (a busca
 * traz o nome certo, com acento); o texto colado só vale mais quando diz o título.
 */
export function importPastedText(text: string, url: string, hint: PageHint = {}): ImportedSong {
  const song = importPlainText(text);
  const known = { ...hintFromUrl(url), ...hint };
  const guessed = !song.title || song.warnings.includes(DEDUCED_TITLE_WARNING);

  return {
    ...song,
    ...(guessed && known.title && { title: known.title }),
    ...(!song.artist && known.artist && { artist: known.artist }),
    warnings: [
      ...song.warnings.filter((w) => !(guessed && known.title && w === DEDUCED_TITLE_WARNING)),
      `Copiada do ${siteNameOf(url)}. Confira título, artista e acordes antes de salvar.`,
    ],
  };
}
