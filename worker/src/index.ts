/**
 * Cloudflare Worker — Minha Biblioteca de Cifras
 *
 * Responsabilidades:
 *  - Servir os assets estáticos do build do frontend (SPA fallback).
 *  - Gerar `/sitemap.xml` dinamicamente a partir do índice de músicas.
 *  - `/api/format`: formatar cifra colada em ChordPro usando o Gemini (Google).
 *    A chave da API é um secret do Worker — nunca vai ao navegador.
 *  - Headers de segurança e cache.
 */

import {
  FORMAT_SYSTEM,
  FORMAT_SCHEMA,
  GENERATE_SYSTEM,
  GENERATE_SCHEMA,
  CANDIDATES_SYSTEM,
  CANDIDATES_SCHEMA,
  type FormatResult,
  type GenerateResult,
  type CandidatesResult,
} from './format-prompt';
import { json } from './lib/http';
import type { Env } from './types';
import { login, logout, me } from './api/auth';
import { songsRoute } from './api/songs';
import { playlistsRoute } from './api/playlists';

export type { Env };


/** Modelo do Gemini. `gemini-flash-latest` aponta sempre para o Flash atual. */
const MODEL = 'gemini-flash-latest';
/** Limite de texto aceito (evita abusos e custo). */
const MAX_INPUT_CHARS = 20_000;

interface SongIndexEntry {
  readonly id: string;
  readonly title: string;
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function buildSitemap(request: Request, env: Env): Promise<Response> {
  const origin = env.SITE_URL ?? new URL(request.url).origin;

  let entries: readonly SongIndexEntry[] = [];
  try {
    const indexResponse = await env.ASSETS.fetch(new URL('/songs/index.json', origin));
    if (indexResponse.ok) {
      const data = (await indexResponse.json()) as { songs?: SongIndexEntry[] } | SongIndexEntry[];
      entries = Array.isArray(data) ? data : (data.songs ?? []);
    }
  } catch {
    entries = [];
  }

  const staticPaths = ['/', '/playlists', '/editor', '/importar'];
  const urls = [
    ...staticPaths.map((p) => `${origin}${p}`),
    ...entries.map((song) => `${origin}/musica/${encodeURI(song.id)}`),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/** Resposta (parcial) do endpoint generateContent do Gemini. */
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

type GeminiCall =
  | { ok: true; raw: string }
  | { ok: false; status: number; error: string };

/** Chamada única ao Gemini com saída estruturada (JSON pelo schema). */
async function callGemini(
  env: Env,
  system: string,
  schema: unknown,
  userText: string,
): Promise<GeminiCall> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent` +
    `?key=${encodeURIComponent(env.GEMINI_API_KEY!)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Gemini erro HTTP', res.status, detail);
    const error =
      res.status === 429
        ? 'Limite de uso da IA atingido. Tente daqui a pouco.'
        : 'Não foi possível processar agora. Verifique a chave da IA.';
    return { ok: false, status: 502, error };
  }

  // Decodifica explicitamente como UTF-8 — evita mojibake em acentos (ã, ç…)
  // caso o runtime erre o charset do corpo da resposta.
  const decoded = new TextDecoder('utf-8').decode(await res.arrayBuffer());
  const data = JSON.parse(decoded) as GeminiResponse;
  if (data.promptFeedback?.blockReason) {
    return { ok: false, status: 422, error: 'A IA recusou processar este conteúdo.' };
  }
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return { ok: false, status: 502, error: 'Resposta vazia da IA.' };
  return { ok: true, raw };
}

/** Converte texto bruto de cifra em ChordPro. */
async function formatWithAI(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) return json({ error: 'IA não configurada neste servidor.' }, 501);

  let text: string;
  try {
    const payload = (await request.json()) as { text?: unknown };
    text = typeof payload.text === 'string' ? payload.text.trim() : '';
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }
  if (!text) return json({ error: 'Envie o texto da cifra.' }, 400);
  if (text.length > MAX_INPUT_CHARS) {
    return json({ error: 'Texto muito longo. Cole uma música por vez.' }, 413);
  }

  try {
    const result = await callGemini(env, FORMAT_SYSTEM, FORMAT_SCHEMA, text);
    if (!result.ok) return json({ error: result.error }, result.status);
    return json(JSON.parse(result.raw) as FormatResult);
  } catch (err) {
    console.error('Falha ao formatar com IA:', err);
    return json({ error: 'Não foi possível formatar agora. Tente novamente.' }, 502);
  }
}

/** Gera a cifra de uma música conhecida a partir do nome. */
async function generateWithAI(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) return json({ error: 'IA não configurada neste servidor.' }, 501);

  let title: string;
  let artist: string;
  let key: string;
  let excerpt: string;
  try {
    const payload = (await request.json()) as {
      title?: unknown;
      artist?: unknown;
      key?: unknown;
      excerpt?: unknown;
    };
    title = typeof payload.title === 'string' ? payload.title.trim() : '';
    artist = typeof payload.artist === 'string' ? payload.artist.trim() : '';
    key = typeof payload.key === 'string' ? payload.key.trim() : '';
    excerpt = typeof payload.excerpt === 'string' ? payload.excerpt.trim().slice(0, 500) : '';
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }
  if (!title) return json({ error: 'Informe o nome da música.' }, 400);
  if (title.length > 200) return json({ error: 'Nome muito longo.' }, 413);

  const userText = [
    `Música: ${title}`,
    `Artista: ${artist || '(não informado)'}`,
    `Tom desejado: ${key || '(use o tom original)'}`,
    excerpt ? `Trecho da letra (é a fonte da verdade sobre QUAL música é): ${excerpt}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const result = await callGemini(env, GENERATE_SYSTEM, GENERATE_SCHEMA, userText);
    if (!result.ok) return json({ error: result.error }, result.status);
    return json(JSON.parse(result.raw) as GenerateResult);
  } catch (err) {
    console.error('Falha ao gerar com IA:', err);
    return json({ error: 'Não foi possível gerar agora. Tente novamente.' }, 502);
  }
}

/** Lista músicas conhecidas com um dado nome, ordenadas por confiança. */
async function findCandidates(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) return json({ error: 'IA não configurada neste servidor.' }, 501);

  let title: string;
  let artist: string;
  try {
    const payload = (await request.json()) as { title?: unknown; artist?: unknown };
    title = typeof payload.title === 'string' ? payload.title.trim() : '';
    artist = typeof payload.artist === 'string' ? payload.artist.trim() : '';
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }
  if (!title) return json({ error: 'Informe o nome da música.' }, 400);
  if (title.length > 200) return json({ error: 'Nome muito longo.' }, 413);

  const userText = `Nome: ${title}\nArtista: ${artist || '(não informado)'}`;
  const order = { alta: 0, media: 1, baixa: 2 };

  try {
    const result = await callGemini(env, CANDIDATES_SYSTEM, CANDIDATES_SCHEMA, userText);
    if (!result.ok) return json({ error: result.error }, result.status);
    const data = JSON.parse(result.raw) as CandidatesResult;
    // Garante a ordenação por confiança mesmo se o modelo não ordenar.
    data.candidates.sort((a, b) => (order[a.confidence] ?? 3) - (order[b.confidence] ?? 3));
    return json(data);
  } catch (err) {
    console.error('Falha ao buscar candidatas:', err);
    return json({ error: 'Não foi possível buscar agora. Tente novamente.' }, 502);
  }
}

/* ==========================================================================
   /api/fetch-page — busca o HTML de uma página de cifra
   ========================================================================== */

/** Teto do que aceitamos baixar: uma página de cifra não passa nem perto. */
const MAX_PAGE_BYTES = 1_500_000;
const PAGE_TIMEOUT_MS = 10_000;
/** Saltos de redirecionamento seguidos à mão, revalidando o destino a cada um. */
const MAX_REDIRECTS = 3;

/**
 * Endereços que o Worker não deve buscar em nome de quem pediu.
 *
 * Sem esta lista, o endpoint viraria um proxy para a rede interna: bastaria
 * pedir `http://192.168.0.1` ou o serviço de metadados da nuvem e ler a
 * resposta pelo app (SSRF). Bloqueamos por nome de host — é o que temos antes
 * de resolver o DNS.
 */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) return true;
  // Metadados de nuvem (AWS/GCP/Azure) e afins.
  if (host === 'metadata.google.internal' || host === '169.254.169.254') return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

/** Valida o endereço pedido; devolve a mensagem de recusa ou `null`. */
function rejectUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return 'Endereço inválido. Cole o link completo, começando com https://';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Só dá para buscar endereços http:// ou https://';
  }
  if (isBlockedHost(parsed.hostname)) {
    return 'Esse endereço não pode ser buscado.';
  }
  return null;
}

/**
 * Baixa a página e devolve o HTML cru para o app extrair a cifra.
 *
 * Precisa morar aqui: o navegador não consegue buscar outro site por causa do
 * CORS. O Worker faz a busca e o `html-importer` do frontend, que já sabe
 * achar o bloco `<pre>` usado pelos sites de cifra, faz o resto.
 */
async function fetchSongPage(request: Request): Promise<Response> {
  let target = '';
  try {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url === 'string') target = body.url.trim();
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }
  if (!target) return json({ error: 'Informe o endereço da cifra.' }, 400);

  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const rejection = rejectUrl(current);
    if (rejection) return json({ error: rejection }, 400);

    let response: Response;
    try {
      response = await fetch(current, {
        method: 'GET',
        // Manual para revalidar cada destino: seguir automaticamente deixaria
        // um redirecionamento levar a busca para um host bloqueado.
        redirect: 'manual',
        headers: {
          // Sem um user-agent de navegador, vários sites devolvem 403.
          'User-Agent':
            'Mozilla/5.0 (compatible; CifrasCapela/1.0; +https://github.com/GianSE/cifras-capela)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
    } catch (err) {
      console.error('Falha ao buscar a página:', err);
      return json({ error: 'Não foi possível acessar esse endereço.' }, 502);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return json({ error: 'Redirecionamento sem destino.' }, 502);
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) {
      return json({ error: `O site respondeu ${response.status}.` }, 502);
    }

    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('html') && !type.includes('text/plain')) {
      return json({ error: 'Esse endereço não devolveu uma página de texto.' }, 415);
    }

    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_PAGE_BYTES) {
      return json({ error: 'Página grande demais.' }, 413);
    }

    const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
    return json({ html, url: current });
  }

  return json({ error: 'Redirecionamentos demais.' }, 502);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/sitemap.xml') {
      return withSecurityHeaders(await buildSitemap(request, env));
    }

    if (url.pathname === '/api/format') {
      // GET informa se a IA está disponível (o app usa para mostrar o botão).
      if (request.method === 'GET') {
        return withSecurityHeaders(json({ available: Boolean(env.GEMINI_API_KEY) }));
      }
      if (request.method === 'POST') {
        return withSecurityHeaders(await formatWithAI(request, env));
      }
      return withSecurityHeaders(json({ error: 'Método não permitido.' }, 405));
    }

    if (url.pathname === '/api/generate') {
      if (request.method === 'POST') {
        return withSecurityHeaders(await generateWithAI(request, env));
      }
      return withSecurityHeaders(json({ error: 'Método não permitido.' }, 405));
    }

    if (url.pathname === '/api/fetch-page') {
      if (request.method === 'POST') {
        return withSecurityHeaders(await fetchSongPage(request));
      }
      return withSecurityHeaders(json({ error: 'Método não permitido.' }, 405));
    }

    if (url.pathname === '/api/song-candidates') {
      if (request.method === 'POST') {
        return withSecurityHeaders(await findCandidates(request, env));
      }
      return withSecurityHeaders(json({ error: 'Método não permitido.' }, 405));
    }

    // ---- Sessão de quem edita (JWT em cookie httpOnly) ----
    if (url.pathname === '/api/auth/login') {
      if (request.method === 'POST') return withSecurityHeaders(await login(request, env));
      return withSecurityHeaders(json({ error: 'Método não permitido.' }, 405));
    }

    if (url.pathname === '/api/auth/logout') {
      if (request.method === 'POST') return withSecurityHeaders(logout(env));
      return withSecurityHeaders(json({ error: 'Método não permitido.' }, 405));
    }

    if (url.pathname === '/api/auth/me') {
      if (request.method === 'GET') return withSecurityHeaders(await me(request, env));
      return withSecurityHeaders(json({ error: 'Método não permitido.' }, 405));
    }

    // ---- Biblioteca (ler é público; escrever exige sessão) ----
    if (url.pathname === '/api/songs' || url.pathname.startsWith('/api/songs/')) {
      return withSecurityHeaders(await songsRoute(request, env, url.pathname));
    }

    if (url.pathname === '/api/playlists' || url.pathname.startsWith('/api/playlists/')) {
      return withSecurityHeaders(await playlistsRoute(request, env, url.pathname));
    }

    if (url.pathname.startsWith('/api/')) {
      return withSecurityHeaders(json({ error: 'Not implemented' }, 501));
    }

    // Demais requisições → assets estáticos (SPA).
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<Env>;
