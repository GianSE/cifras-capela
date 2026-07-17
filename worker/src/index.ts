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

import { FORMAT_SYSTEM, FORMAT_SCHEMA, type FormatResult } from './format-prompt';

export interface Env {
  /** Binding para os assets estáticos (configurado em wrangler.toml). */
  ASSETS: Fetcher;
  /** URL pública do site, usada no sitemap. */
  SITE_URL?: string;
  /** Chave da API do Gemini (secret: `wrangler secret put GEMINI_API_KEY`). */
  GEMINI_API_KEY?: string;
}

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
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

/** Converte texto bruto de cifra em ChordPro usando o Gemini. */
async function formatWithAI(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'IA não configurada neste servidor.' }, 501);
  }

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

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent` +
    `?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: FORMAT_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: FORMAT_SCHEMA,
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('Gemini erro HTTP', res.status, detail);
      // 400 costuma ser chave inválida; 429 é limite de uso.
      const msg =
        res.status === 429
          ? 'Limite de uso da IA atingido. Tente daqui a pouco.'
          : 'Não foi possível formatar agora. Verifique a chave da IA.';
      return json({ error: msg }, 502);
    }

    const data = (await res.json()) as GeminiResponse;

    if (data.promptFeedback?.blockReason) {
      return json({ error: 'A IA recusou processar este conteúdo.' }, 422);
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      return json({ error: 'Resposta vazia da IA.' }, 502);
    }

    const result = JSON.parse(raw) as FormatResult;
    return json(result);
  } catch (err) {
    console.error('Falha ao formatar com IA:', err);
    return json({ error: 'Não foi possível formatar agora. Tente novamente.' }, 502);
  }
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

    if (url.pathname.startsWith('/api/')) {
      return withSecurityHeaders(json({ error: 'Not implemented' }, 501));
    }

    // Demais requisições → assets estáticos (SPA).
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<Env>;
