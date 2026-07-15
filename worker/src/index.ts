/**
 * Cloudflare Worker — Minha Biblioteca de Cifras
 *
 * Responsabilidades atuais (sem banco de dados):
 *  - Servir os assets estáticos do build do frontend (SPA fallback).
 *  - Gerar `/sitemap.xml` dinamicamente a partir do índice de músicas.
 *  - Adicionar headers de segurança e cache.
 *
 * Lugar reservado: rotas `/api/*` para quando houver backend real.
 */

export interface Env {
  /** Binding para os assets estáticos (configurado em wrangler.toml). */
  ASSETS: Fetcher;
  /** URL pública do site, usada no sitemap. Definível via `vars`/secret. */
  SITE_URL?: string;
}

/** Entrada mínima do índice de músicas gerado em build time. */
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

  const staticPaths = ['/', '/favoritos', '/buscar', '/categorias'];
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/sitemap.xml') {
      return withSecurityHeaders(await buildSitemap(request, env));
    }

    // Espaço reservado para APIs futuras.
    if (url.pathname.startsWith('/api/')) {
      return withSecurityHeaders(
        new Response(JSON.stringify({ error: 'Not implemented' }), {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }

    // Demais requisições → assets estáticos (SPA).
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<Env>;
