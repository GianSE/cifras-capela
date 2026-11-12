/**
 * @module lib/catalog
 * @description Busca de cifras novas nos sites de cifras.
 *
 * O catálogo é um **mapa de endereços**: vem dos sitemaps públicos dos sites, que
 * dizem que páginas existem, e não guarda cifra nenhuma. A cifra só é baixada
 * quando alguém escolhe a música.
 *
 * O título sai do próprio endereço, então vem sem acentos e, às vezes, com um
 * sufixo do site (`...-arq-goiania`). O nome certo aparece na revisão, já lido
 * da página.
 */

import { normalizeText } from '@/lib/library/duplicates';

export type CatalogSource = 'musicas-para-missa' | 'cifras-catolicas' | 'decifrando';

export interface CatalogEntry {
  readonly source: CatalogSource;
  readonly url: string;
  readonly title: string;
  readonly artist?: string;
  /** Título e artista normalizados: é onde a busca procura. */
  readonly words: string;
}

export const SOURCE_NAMES: Readonly<Record<CatalogSource, string>> = {
  'musicas-para-missa': 'Músicas para Missa',
  'cifras-catolicas': 'Cifras Católicas',
  decifrando: 'Decifrando',
};

const SOURCES = Object.keys(SOURCE_NAMES) as CatalogSource[];

function decodePath(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/** `a-alegria-esta-no-coracao` → `A alegria esta no coracao`. */
export function slugToTitle(slug: string): string {
  const text = decodePath(slug).replace(/-+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Como cada site organiza os endereços. Devolve `null` se a página não é uma música. */
const PARSERS: Readonly<
  Record<CatalogSource, (segments: string[]) => { title: string; artist?: string } | null>
> = {
  // /musica/<música>/ — o sitemap também lista categorias e sugestões por dia.
  'musicas-para-missa': ([kind, slug, ...rest]) =>
    kind === 'musica' && slug && rest.length === 0 ? { title: slugToTitle(slug) } : null,
  // /<artista>/<música> — com um pedaço só, é a página do artista.
  'cifras-catolicas': ([artist, slug, ...rest]) =>
    artist && slug && rest.length === 0
      ? { title: slugToTitle(slug), artist: slugToTitle(artist) }
      : null,
  // Mesmo formato do Cifras Católicas; páginas de uma música só têm dois pedaços.
  // "musicas/artistas" é a única página do próprio site nesse formato — o
  // índice de artistas, não uma música — por isso a exceção.
  decifrando: ([artist, slug, ...rest]) =>
    artist && slug && rest.length === 0 && !(artist === 'musicas' && slug === 'artistas')
      ? { title: slugToTitle(slug), artist: slugToTitle(artist) }
      : null,
};

/** Lê as músicas de um sitemap, ignorando as demais páginas do site. */
export function parseSitemap(source: CatalogSource, xml: string): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const [, raw] of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    let url: URL;
    try {
      url = new URL(raw!);
    } catch {
      continue;
    }
    const parsed = PARSERS[source](url.pathname.split('/').filter(Boolean));
    if (!parsed) continue;
    entries.push({
      source,
      url: url.href,
      ...parsed,
      words: normalizeText(`${parsed.title} ${parsed.artist ?? ''}`),
    });
  }
  return entries;
}

/**
 * Todas as palavras da busca precisam aparecer, como começo de palavra (`seg`
 * acha "segura"). Títulos que começam pela busca vêm primeiro, e entre eles os
 * mais curtos: costumam ser a música em si, e não uma variação dela.
 */
export function searchCatalog(
  entries: readonly CatalogEntry[],
  query: string,
  limit = 10,
): CatalogEntry[] {
  const normalized = normalizeText(query);
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const rank = (entry: CatalogEntry) => (entry.words.startsWith(normalized) ? 0 : 1);

  return entries
    .filter((entry) => {
      const haystack = ` ${entry.words}`;
      return tokens.every((token) => haystack.includes(` ${token}`));
    })
    .sort((a, b) => rank(a) - rank(b) || a.words.length - b.words.length)
    .slice(0, limit);
}

/** Uma só cópia por sessão: o catálogo é grande e muda pouco. */
let loading: Promise<{ entries: CatalogEntry[]; failed: CatalogSource[] }> | null = null;

async function fetchSource(source: CatalogSource): Promise<CatalogEntry[]> {
  const res = await fetch(`/api/catalog/${source}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Catálogo ${source} respondeu ${res.status}`);
  return parseSitemap(source, await res.text());
}

/**
 * Carrega o catálogo na primeira busca. Um site fora do ar não derruba os outros,
 * e a falta dele é informada para a tela não dizer que a música não existe.
 */
export function loadCatalog(): Promise<{ entries: CatalogEntry[]; failed: CatalogSource[] }> {
  loading ??= Promise.allSettled(SOURCES.map(fetchSource)).then((results) => {
    const failed = SOURCES.filter((_, i) => results[i]!.status === 'rejected');
    // Falhou algo: a próxima busca tenta de novo, em vez de ficar assim até recarregar.
    if (failed.length > 0) loading = null;
    return {
      failed,
      entries: results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    };
  });
  return loading;
}

