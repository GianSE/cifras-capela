/**
 * @module lib/import/html-importer
 * @description Converte HTML (ex.: página de cifra salva) em texto e reaproveita
 * o importador de texto. Prioriza blocos <pre> (comuns em sites de cifra).
 *
 * Sites com marcação própria ganham um adaptador em `sites/`, que sabe achar
 * mais do que o caminho genérico — o Músicas para Missa, por exemplo, também
 * informa quem canta e o momento da missa. Quando nenhum adaptador reconhece a
 * página, vale o caminho genérico, que funciona em qualquer site de cifra.
 */
import {
  DEDUCED_KEY_WARNING_PREFIX,
  DEDUCED_TITLE_WARNING,
  MISSING_KEY_WARNING,
  importPlainText,
} from './text-importer';
import { importMusicasParaMissa } from './sites/musicas-para-missa';
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
    // Tablaturas saem inteiras. O botão "ocultar tablaturas" do CifraClub só
    // age no navegador; o HTML que chega aqui sempre as traz, embrulhadas em
    // `.tabs > .tab`. O traçado (`E|---|`) já era descartado como lixo, mas o
    // rótulo "Parte 1 de 2" e os acordes em cima dele vazavam para a cifra.
    // Diferente das classes geradas do site, `tabs`/`tab` têm nome estável.
    pre.querySelectorAll('.tabs, .tab').forEach((el) => el.remove());
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

/** Um tom, e só um tom: `D`, `Em`, `F#m`, `Bb`. */
const KEY_VALUE_RE = /^[A-G][#b]?m?$/;

/**
 * Tom informado pela própria página.
 *
 * No CifraClub fica no seletor `id="key"`: um `<p>` com o rótulo "Tom" e outro
 * com o valor, entre os botões de subir e descer. As classes são geradas e
 * mudam a cada versão do site, então a busca ancora no `id` e só aceita o que
 * tem forma de tom — outro site com um `id="key"` qualquer não vira tom.
 */
export function parsePageKey(doc: Document): string | undefined {
  const box = doc.querySelector('#key');
  if (!box) return undefined;
  for (const el of box.querySelectorAll('p, span')) {
    const text = el.textContent?.trim() ?? '';
    if (KEY_VALUE_RE.test(text)) return text;
  }
  return undefined;
}

const isKeyGuessWarning = (w: string) =>
  w.startsWith(DEDUCED_KEY_WARNING_PREFIX) || w === MISSING_KEY_WARNING;

/**
 * Vídeo da música. O CifraClub não põe o player no HTML inicial, mas manda o
 * id nos dados da página (`"youtubeID":"vpp-DP1JTLk"`, às vezes com as aspas
 * escapadas por estar dentro de outro JSON). Links comuns do YouTube na página
 * servem de reserva para outros sites.
 */
export function parsePageYoutube(html: string): string | undefined {
  const fromData = html.match(/youtubeID\\?"\s*:\s*\\?"([A-Za-z0-9_-]{11})\\?"/)?.[1];
  if (fromData) return fromData;
  const fromLink = html.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  )?.[1];
  return fromLink;
}

export function importHtml(html: string): ImportedSong {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  let song = importMusicasParaMissa(doc);
  const generico = song === null;
  song ??= importPlainText(docToText(doc));

  const youtube = parsePageYoutube(html);
  if (youtube) song = { ...song, youtube };

  // O adaptador já leu título, artista e categoria do lugar certo.
  if (!generico) return song;

  // O `<title>` não entra mais como linha do texto: no CifraClub ele termina
  // em "- Cifra Club", o filtro de lixo do site o descartava, e sem título o
  // importador ia buscá-lo na letra. Agora é lido à parte.
  // Um título escrito no próprio texto ("Título: ...") vale mais que o da
  // página; só o adivinhado é substituído. O mesmo vale para o tom.
  const page = parsePageTitle(doc.querySelector('title')?.textContent ?? '');
  const titleWasGuessed = !song.title || song.warnings.includes(DEDUCED_TITLE_WARNING);
  if (page.title && titleWasGuessed) {
    song = {
      ...song,
      title: page.title,
      artist: song.artist ?? page.artist,
      warnings: song.warnings.filter((w) => w !== DEDUCED_TITLE_WARNING),
    };
  }

  // Tom: adivinhar pelo primeiro acorde erra fácil — em "Terra Seca" dava Em,
  // porque a linha do [Intro] é pulada. A página sabe o tom de verdade.
  const pageKey = parsePageKey(doc);
  const keyWasGuessed = !song.key || song.warnings.some(isKeyGuessWarning);
  if (pageKey && keyWasGuessed) {
    song = {
      ...song,
      key: pageKey,
      warnings: song.warnings.filter((w) => !isKeyGuessWarning(w)),
    };
  }

  return song;
}
