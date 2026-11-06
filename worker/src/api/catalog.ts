/**
 * Catálogo: de onde vêm os resultados da busca de cifras novas.
 *
 * Nada de copiar sites: só se mapeiam os **endereços**, e a cifra é baixada
 * quando alguém escolhe a música (por `/api/fetch-page`, como o link colado).
 *
 *   GET /api/catalog/<fonte>        → sitemap da fonte, como veio do site
 *   GET /api/catalog/cifraclub?q=…  → sugestões do CifraClub
 *   GET /api/catalog/sugestoes/datas   → mapa data → dia litúrgico
 *   GET /api/catalog/sugestoes/<dia>   → página de sugestões de um dia
 *
 * O sitemap passa direto, sem ser lido aqui: são quase 2 MB, e interpretar isso
 * a cada busca gastaria o tempo de CPU do Worker. Quem lê e procura é o app, que
 * já faz o mesmo com a biblioteca. A Cloudflare guarda a cópia por um dia, então
 * os sites recebem no máximo uma visita por dia, tenha quantas buscas tiver.
 *
 * É coisa de administrador, como o `/api/fetch-page`. As fontes são uma lista
 * fechada para isto não virar um proxy aberto.
 */

import type { Env } from '../types';
import { json, methodNotAllowed, unauthorized } from '../lib/http';
import { currentAccount, forbidden } from '../lib/access';

/** Sitemaps públicos, cujos `robots.txt` não restringem robôs. */
const SITEMAPS: Readonly<Record<string, string>> = {
  'musicas-para-missa': 'https://musicasparamissa.com.br/sitemap.xml',
  'cifras-catolicas': 'https://cifrascatolicas.com.br/sitemap.xml',
  decifrando: 'https://decifrando.app.br/sitemap.xml',
};

const ONE_DAY = 60 * 60 * 24;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CIFRACLUB_RESULTS = 8;

const USER_AGENT =
  'Mozilla/5.0 (compatible; CifrasCapela/1.0; +https://github.com/GianSE/cifras-capela)';

/** Resultado do autocompletar: `t` 2 é música; `d`/`u` são os pedaços do endereço. */
interface CifraClubDoc {
  t?: unknown;
  m?: unknown;
  a?: unknown;
  d?: unknown;
  u?: unknown;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;

const MPM = 'https://musicasparamissa.com.br';

export async function catalogRoute(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed();

  const account = await currentAccount(request, env);
  if (!account) return unauthorized();
  if (account.role !== 'admin') return forbidden();

  const source = decodeURIComponent(pathname.slice('/api/catalog/'.length));
  if (source === 'cifraclub') {
    return searchCifraClub(new URL(request.url).searchParams.get('q') ?? '');
  }

  if (source === 'sugestoes/datas') {
    return passThrough(`${MPM}/datas.json`, 'application/json; charset=utf-8');
  }
  if (source.startsWith('sugestoes/')) {
    const day = source.slice('sugestoes/'.length);
    if (!SLUG_RE.test(day)) return json({ error: 'Dia inválido.' }, 400);
    return passThrough(`${MPM}/sugestoes-para/${day}/`, 'text/html; charset=utf-8');
  }

  const sitemap = SITEMAPS[source];
  if (!sitemap) return json({ error: 'Fonte desconhecida.' }, 404);
  return passThrough(sitemap, 'application/xml; charset=utf-8');
}

/** Repassa o arquivo como veio do site, com cache de um dia. */
async function passThrough(url: string, contentType: string): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      cf: { cacheEverything: true, cacheTtl: ONE_DAY },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('Falha ao buscar no site:', url, err);
    return json({ error: 'O site não respondeu.' }, 502);
  }
  if (!upstream.ok) return json({ error: `O site respondeu ${upstream.status}.` }, 502);

  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `private, max-age=${ONE_DAY}`,
    },
  });
}

/**
 * Sugestões do CifraClub. O site não tem API pública: este é o endereço que o
 * campo de busca dele usa, e pode mudar sem aviso. Por isso, falhar aqui nunca é
 * erro para o app: volta `unavailable`, e a busca segue com as outras fontes.
 */
async function searchCifraClub(rawQuery: string): Promise<Response> {
  const query = rawQuery.trim().slice(0, 80);
  if (query.length < 3) return json({ results: [] });

  const unavailable = () => json({ results: [], unavailable: true });

  try {
    const res = await fetch(`https://solr.sscdn.co/cc/h2/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT },
      cf: { cacheEverything: true, cacheTtl: 60 * 60 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return unavailable();

    // A resposta vem embrulhada em parênteses: `({...})`.
    const text = (await res.text()).trim().replace(/^\(/, '').replace(/\)$/, '');
    const data = JSON.parse(text) as { response?: { docs?: CifraClubDoc[] } };

    const results = (data.response?.docs ?? [])
      .filter(
        (d) =>
          String(d.t) === '2' &&
          typeof d.m === 'string' &&
          typeof d.a === 'string' &&
          // O endereço é montado com isto: só aceita o que tem forma de slug.
          typeof d.d === 'string' &&
          typeof d.u === 'string' &&
          SLUG_RE.test(d.d) &&
          SLUG_RE.test(d.u),
      )
      .slice(0, MAX_CIFRACLUB_RESULTS)
      .map((d) => ({
        title: d.m,
        artist: d.a,
        url: `https://www.cifraclub.com.br/${d.d}/${d.u}/`,
      }));

    return json({ results }, 200, { 'Cache-Control': 'private, max-age=3600' });
  } catch (err) {
    console.warn('Sugestões do CifraClub indisponíveis:', err);
    return unavailable();
  }
}
