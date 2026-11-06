/**
 * @module lib/missa-suggestions
 * @description Sugestões de músicas para o dia da missa, do Músicas para Missa.
 *
 * O site tem uma página por dia litúrgico (`/sugestoes-para/<dia>/`), com as
 * músicas de cada parte da celebração, e um mapa público `datas.json`, que o
 * calendário dele usa para ir da data à página. O mapa cobre só alguns meses:
 * fora disso, escolhe-se o dia pelo nome, na lista do sitemap.
 *
 * As páginas passam pelo Worker com cache de um dia (`/api/catalog/sugestoes`).
 */

import { normalizeText } from '@/lib/library/duplicates';
import { slugToTitle } from '@/lib/catalog';

export interface LiturgicalDay {
  readonly slug: string;
  readonly title: string;
}

export interface SuggestedSong {
  readonly title: string;
  readonly url: string;
}

export interface SuggestionGroup {
  /** Como o site chama a parte, ex.: "Canto de Abertura". */
  readonly heading: string;
  readonly songs: readonly SuggestedSong[];
  /** Página do site com mais opções para esta parte. */
  readonly moreUrl?: string;
}

const SITE = 'https://musicasparamissa.com.br';

/** `Canto de Abertura - Sugestões de Músicas` → `Canto de Abertura`. */
function cleanHeading(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*Sugest[õo]es de [^:]*:?\s*$/i, '')
    .trim();
}

/** Lê as partes com música da página de um dia (leituras e antífonas ficam de fora). */
export function parseSuggestionsPage(doc: Document): SuggestionGroup[] {
  const groups: SuggestionGroup[] = [];

  for (const heading of doc.querySelectorAll('.sugestoes-para .accordion-heading')) {
    const body = heading.nextElementSibling;
    if (!body) continue;

    const songs: SuggestedSong[] = [];
    for (const link of body.querySelectorAll('li > a[href^="/musica/"]')) {
      const title = link.textContent?.replace(/\s+/g, ' ').trim();
      const href = link.getAttribute('href');
      if (title && href) songs.push({ title, url: new URL(href, SITE).href });
    }
    if (songs.length === 0) continue;

    const more = body.querySelector('.sugestoes-para__links a')?.getAttribute('href');
    groups.push({
      heading: cleanHeading(heading.textContent ?? ''),
      songs,
      ...(more && { moreUrl: new URL(more, SITE).href }),
    });
  }

  return groups;
}

/**
 * Parte do site → nomes que a parte pode ter na missa, sem acento. "Pós-comunhão"
 * vem antes de "Comunhão" porque as duas contêm a mesma palavra.
 *
 * O Refrão Orante, sem parte própria na missa, costuma servir de ambientação.
 * A "Entrada da Vela" do Advento vem antes da abertura e não é o canto de entrada.
 */
const PARTS: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/entrada da vela|coroa do advento/i, ['coroa do advento', 'entrada da vela', 'vela']],
  [/abertura|canto de entrada|^entrada/i, ['entrada', 'canto de entrada', 'abertura']],
  [/ato penitencial/i, ['ato penitencial', 'penitencial']],
  [/hino de louvor|gl[oó]ria/i, ['gloria', 'hino de louvor']],
  [/refr[aã]o orante/i, ['ambientacao', 'refrao orante']],
  [/salmo/i, ['salmo']],
  [/aclama[cç][aã]o/i, ['aclamacao']],
  [/oferendas|ofert[oó]rio/i, ['ofertorio', 'oferendas', 'apresentacao das oferendas']],
  [/ora[cç][aã]o eucar[ií]stica/i, ['oracao eucaristica']],
  [/am[eé]m/i, ['amem', 'doxologia']],
  [/pai[\s-]nosso/i, ['pai nosso']],
  [/^santo/i, ['santo']],
  [/cordeiro/i, ['cordeiro']],
  [/p[oó]s[\s-]comunh[aã]o|a[cç][aã]o de gra[cç]as/i, ['pos comunhao', 'acao de gracas']],
  [/comunh[aã]o/i, ['comunhao']],
  [/final/i, ['final', 'canto final']],
];

/**
 * As sugestões para uma parte da missa, pelo nome dela. Aceita o que vem depois
 * do nome ("Comunhão (2ª)", "Aclamação ao Evangelho"), porque as partes podem ser
 * renomeadas e criadas à vontade.
 */
export function suggestionsForSection(
  groups: readonly SuggestionGroup[],
  sectionName: string,
): SuggestionGroup | undefined {
  const name = normalizeText(sectionName);
  return groups.find((group) => {
    const part = PARTS.find(([site]) => site.test(group.heading));
    return part?.[1].some((alias) => name === alias || name.startsWith(`${alias} `));
  });
}

/** O mapa do site: `dd/mm/aaaa` → dia litúrgico. */
export type LiturgicalCalendar = Readonly<
  Record<string, { readonly title?: unknown; readonly url?: unknown }>
>;

function slugFromUrl(url: unknown): string | undefined {
  return typeof url === 'string' ? /\/sugestoes-para\/([a-z0-9-]+)/.exec(url)?.[1] : undefined;
}

function dayOn(calendar: LiturgicalCalendar, date: Date): LiturgicalDay | undefined {
  const pad = (n: number) => String(n).padStart(2, '0');
  const entry =
    calendar[`${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`];
  const slug = slugFromUrl(entry?.url);
  if (!entry || !slug || typeof entry.title !== 'string') return undefined;
  return { slug, title: entry.title.replace(/\s+/g, ' ').trim() };
}

/**
 * Os dias litúrgicos possíveis para a data, o mais provável primeiro.
 *
 * No sábado, vem primeiro o domingo seguinte: a missa de sábado à tarde já
 * costuma ser a do domingo. O próprio sábado fica como segunda opção.
 */
export function daysForDate(calendar: LiturgicalCalendar, isoDate: string): LiturgicalDay[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return [];
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);

  const options = [
    date.getDay() === 6 ? dayOn(calendar, new Date(year, month - 1, day + 1)) : undefined,
    dayOn(calendar, date),
  ];
  return options.filter((d): d is LiturgicalDay => d !== undefined);
}

/** Todos os dias que o site tem, a partir do sitemap: para escolher pelo nome. */
export function parseDaysFromSitemap(xml: string): LiturgicalDay[] {
  const days: LiturgicalDay[] = [];
  for (const [, slug] of xml.matchAll(/<loc>[^<]*\/sugestoes-para\/([a-z0-9-]+)\/?\s*<\/loc>/g)) {
    // `32o` → `32º`, `5a` → `5ª`: o endereço não tem o sinal do ordinal.
    const title = slugToTitle(slug!)
      .replace(/\b(\d+)o\b/g, '$1º')
      .replace(/\b(\d+)a\b/g, '$1ª');
    days.push({ slug: slug!, title });
  }
  return days;
}

/** Procura um dia pelo nome: todas as palavras precisam aparecer. */
export function searchDays(
  days: readonly LiturgicalDay[],
  query: string,
  limit = 8,
): LiturgicalDay[] {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];
  return days
    .filter((day) => {
      const name = ` ${normalizeText(day.title)}`;
      return tokens.every((token) => name.includes(` ${token}`));
    })
    .slice(0, limit);
}

export const dayPageUrl = (slug: string) => `${SITE}/sugestoes-para/${slug}/`;

/* ==========================================================================
   Rede: uma resposta por sessão, porque esses dados mudam pouco
   ========================================================================== */

let calendarLoading: Promise<LiturgicalCalendar> | null = null;
const pages = new Map<string, Promise<SuggestionGroup[]>>();

async function readOk(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`Sugestões responderam ${res.status}`);
  return res;
}

export function loadCalendar(): Promise<LiturgicalCalendar> {
  calendarLoading ??= fetch('/api/catalog/sugestoes/datas', { credentials: 'same-origin' })
    .then(readOk)
    .then((res) => res.json() as Promise<LiturgicalCalendar>)
    .catch((e: unknown) => {
      calendarLoading = null; // Falhou: a próxima tentativa vai à rede de novo.
      throw e;
    });
  return calendarLoading;
}

export function loadSuggestions(slug: string): Promise<SuggestionGroup[]> {
  const cached = pages.get(slug);
  if (cached) return cached;

  const loading = fetch(`/api/catalog/sugestoes/${encodeURIComponent(slug)}`, {
    credentials: 'same-origin',
  })
    .then(readOk)
    .then((res) => res.text())
    .then((html) => parseSuggestionsPage(new DOMParser().parseFromString(html, 'text/html')))
    .catch((e: unknown) => {
      pages.delete(slug);
      throw e;
    });
  pages.set(slug, loading);
  return loading;
}

/** Só para os testes: esquece o que foi carregado. */
export function resetSuggestionsForTests(): void {
  calendarLoading = null;
  pages.clear();
}

/* ==========================================================================
   O dia escolhido à mão, lembrado neste aparelho
   ========================================================================== */

const storageKey = (playlistId: string, date: string | undefined) =>
  `cifras-capela:missa-dia:${playlistId}:${date ?? 'sem-data'}`;

export function readChosenDay(playlistId: string, date?: string): LiturgicalDay | undefined {
  try {
    const stored = localStorage.getItem(storageKey(playlistId, date));
    const day = stored ? (JSON.parse(stored) as Partial<LiturgicalDay>) : undefined;
    return day?.slug && day.title ? { slug: day.slug, title: day.title } : undefined;
  } catch {
    return undefined;
  }
}

export function saveChosenDay(playlistId: string, date: string | undefined, day: LiturgicalDay) {
  try {
    localStorage.setItem(storageKey(playlistId, date), JSON.stringify(day));
  } catch {
    // Sem armazenamento, a escolha vale até sair da tela.
  }
}
