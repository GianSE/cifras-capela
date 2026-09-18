/**
 * Cloudflare Worker — Minha Biblioteca de Cifras
 *
 * Responsabilidades:
 *  - Servir os assets estáticos do build do frontend (SPA fallback).
 *  - `/api/fetch-page`: baixar a página de uma cifra (o navegador não pode, por CORS).
 *  - `/api/auth/*`, `/api/songs`, `/api/playlists`, `/api/users`: login, a
 *    biblioteca no D1 e as contas.
 *
 * O acervo é fechado: toda rota de dados exige sessão, e o site não é
 * indexado por buscadores (robots.txt + meta noindex).
 *  - Headers de segurança e cache.
 */

import { json } from './lib/http';
import type { Env } from './types';
import { login, logout, me } from './api/auth';
import { songsRoute } from './api/songs';
import { playlistsRoute } from './api/playlists';
import { youtubeRoute } from './api/youtube';
import { usersRoute } from './api/users';
import { currentAccount, forbidden } from './lib/access';

export type { Env };


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

    // Importar é coisa de administrador: buscar páginas de fora em nome de
    // quem só lê seria dar um proxy de graça a qualquer conta.
    if (url.pathname === '/api/fetch-page') {
      if (request.method !== 'POST') {
        return withSecurityHeaders(json({ error: 'Método não permitido.' }, 405));
      }
      const account = await currentAccount(request, env);
      if (!account) return withSecurityHeaders(json({ error: 'Não autenticado.' }, 401));
      if (account.role !== 'admin') return withSecurityHeaders(forbidden());
      return withSecurityHeaders(await fetchSongPage(request));
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

    if (url.pathname === '/api/users' || url.pathname.startsWith('/api/users/')) {
      return withSecurityHeaders(await usersRoute(request, env, url.pathname));
    }

    if (url.pathname === '/api/youtube/search') {
      return withSecurityHeaders(await youtubeRoute(request, env));
    }

    if (url.pathname.startsWith('/api/')) {
      return withSecurityHeaders(json({ error: 'Not implemented' }, 501));
    }

    // Demais requisições → assets estáticos (SPA).
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
} satisfies ExportedHandler<Env>;
