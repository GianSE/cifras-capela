/**
 * @module lib/import/html-importer
 * @description Converte HTML (ex.: página de cifra salva) em texto e reaproveita
 * o importador de texto. Prioriza blocos <pre> (comuns em sites de cifra).
 */
import { importPlainText } from './text-importer';
import type { ImportedSong } from './types';

/** Extrai texto legível de um HTML, preservando quebras de linha relevantes. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Muitos sites de cifra usam <pre> com o alinhamento por espaços.
  const pre = doc.querySelector('pre');
  if (pre?.textContent && pre.textContent.trim().length > 0) {
    const title = doc.querySelector('title')?.textContent?.trim();
    return (title ? `${title}\n` : '') + pre.textContent;
  }

  // Converte blocos em quebras de linha.
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.querySelectorAll('p, div, h1, h2, h3, h4, li, tr').forEach((el) => {
    el.append('\n');
  });

  return (doc.body?.textContent ?? '').replace(/\n{3,}/g, '\n\n');
}

export function importHtml(html: string): ImportedSong {
  return importPlainText(htmlToText(html));
}
