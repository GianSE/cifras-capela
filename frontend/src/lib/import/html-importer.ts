/**
 * @module lib/import/html-importer
 * @description Converte HTML (ex.: página de cifra salva) em texto e reaproveita
 * o importador de texto. Prioriza blocos <pre> (comuns em sites de cifra).
 */
import { DEDUCED_TITLE_WARNING, importPlainText } from './text-importer';
import type { ImportedSong } from './types';

/** Nomes de site que aparecem no fim do `<title>` e não fazem parte da música. */
const SITE_NAME_RE = /^(cifra\s?club|cifras?|letras(\.mus\.br)?|ultimate[\s-]?guitar(\.com)?)$/i;

/**
 * Título e artista a partir do `<title>` da página.
 *
 * Sites de cifra usam `Música - Artista - Site`. O nome do site sai; o resto
 * vira título e artista. É a fonte mais confiável que a página oferece — o
 * `<pre>` só tem a cifra, sem cabeçalho.
 */
export function parsePageTitle(raw: string): { title?: string; artist?: string } {
  const parts = raw
    .split(/\s+[-–|]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length > 1 && SITE_NAME_RE.test(parts[parts.length - 1]!)) parts.pop();
  if (parts.length === 0 || SITE_NAME_RE.test(parts[0]!)) return {};

  return { title: parts[0], ...(parts[1] && { artist: parts[1] }) };
}

/** Texto da cifra dentro de um documento já parseado. */
function docToText(doc: Document): string {
  // Muitos sites de cifra usam <pre> com o alinhamento por espaços.
  const pre = doc.querySelector('pre');
  if (pre?.textContent && pre.textContent.trim().length > 0) {
    return pre.textContent;
  }

  // Converte blocos em quebras de linha.
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('p, div, h1, h2, h3, h4, li, tr').forEach((el) => {
    el.append('\n');
  });

  return (doc.body?.textContent ?? '').replace(/\n{3,}/g, '\n\n');
}

/** Extrai texto legível de um HTML, preservando quebras de linha relevantes. */
export function htmlToText(html: string): string {
  return docToText(new DOMParser().parseFromString(html, 'text/html'));
}

export function importHtml(html: string): ImportedSong {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const song = importPlainText(docToText(doc));
  const page = parsePageTitle(doc.querySelector('title')?.textContent ?? '');

  // O `<title>` não entra mais como linha do texto: no CifraClub ele termina
  // em "- Cifra Club", o filtro de lixo do site o descartava, e sem título o
  // importador ia buscá-lo na letra. Agora é lido à parte.
  if (!page.title) return song;

  // Um título escrito no próprio texto ("Título: ...") vale mais que o da
  // página; só o adivinhado é substituído.
  const titleWasGuessed = !song.title || song.warnings.includes(DEDUCED_TITLE_WARNING);
  if (!titleWasGuessed) return song;

  return {
    ...song,
    title: page.title,
    artist: song.artist ?? page.artist,
    warnings: song.warnings.filter((w) => w !== DEDUCED_TITLE_WARNING),
  };
}
