/**
 * Busca de vídeos no YouTube, para achar o vídeo da música sem sair do app.
 *
 * Usa a YouTube Data API v3, que precisa de uma chave
 * (`wrangler secret put YOUTUBE_API_KEY`). Sem a chave, responde 501 e o app
 * cai no caminho manual: abrir a busca no YouTube e colar o link.
 *
 * Exige sessão: a cota diária é pequena (cada busca custa 100 das 10.000
 * unidades por dia), e deixá-la aberta seria entregá-la a quem passar por ali.
 */

import type { Env } from '../types';
import { json, methodNotAllowed, unauthorized } from '../lib/http';
import { currentUser } from '../lib/session';

const MAX_QUERY = 120;
const MAX_RESULTS = 8;
const TIMEOUT_MS = 8_000;
/** Mesma busca em 6h devolve o mesmo vídeo — poupa cota. */
const CACHE_TTL_SECONDS = 21_600;

interface YoutubeSearchResponse {
  items?: {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
  }[];
  error?: { message?: string; errors?: { reason?: string }[] };
}

/** `GET /api/youtube/search?q=...` */
export async function youtubeRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed();

  const user = await currentUser(request, env.JWT_SECRET);
  if (!user) return unauthorized();

  if (!env.YOUTUBE_API_KEY) {
    return json(
      {
        error: 'Busca do YouTube não configurada.',
        reason: 'not-configured',
      },
      501,
    );
  }

  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
  if (!query) return json({ error: 'Informe o que procurar.' }, 400);

  const endpoint = new URL('https://www.googleapis.com/youtube/v3/search');
  endpoint.searchParams.set('part', 'snippet');
  endpoint.searchParams.set('type', 'video');
  // Só vídeos que podem ser embutidos: os demais abririam um player vazio.
  endpoint.searchParams.set('videoEmbeddable', 'true');
  endpoint.searchParams.set('maxResults', String(MAX_RESULTS));
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('key', env.YOUTUBE_API_KEY);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
    });
  } catch {
    return json({ error: 'A busca do YouTube não respondeu. Tente de novo.' }, 502);
  }

  const data = (await response.json().catch(() => ({}))) as YoutubeSearchResponse;

  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason ?? '';
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      return json(
        { error: 'A busca do YouTube atingiu o limite de hoje. Cole o link à mão.' },
        429,
      );
    }
    return json({ error: 'A busca do YouTube falhou. Cole o link à mão.' }, 502);
  }

  const results = (data.items ?? [])
    .map((item) => {
      const id = item.id?.videoId;
      if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
      const snippet = item.snippet ?? {};
      const thumbnails = snippet.thumbnails ?? {};
      return {
        id,
        // A API devolve o título com entidades HTML (&amp;, &#39;).
        title: decodeEntities(snippet.title ?? ''),
        channel: decodeEntities(snippet.channelTitle ?? ''),
        thumbnail: thumbnails.medium?.url ?? thumbnails.default?.url ?? '',
        publishedAt: snippet.publishedAt ?? '',
      };
    })
    .filter((v) => v !== null);

  return json({ results }, 200, { 'Cache-Control': 'private, max-age=300' });
}

/** As poucas entidades que aparecem em títulos do YouTube. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
