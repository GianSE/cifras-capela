/**
 * @module lib/youtube-search
 * @description Busca de vídeos pelo Worker (`/api/youtube/search`).
 *
 * A chave da API do YouTube vive só no servidor, e a busca pede sessão. Quando
 * ela não está configurada, o app não mostra a busca interna — continua dando
 * para colar o link à mão.
 */

export interface YoutubeResult {
  readonly id: string;
  readonly title: string;
  readonly channel: string;
  readonly thumbnail: string;
  readonly publishedAt: string;
}

export type YoutubeSearch =
  | { readonly status: 'ok'; readonly results: YoutubeResult[] }
  /** Falta a `YOUTUBE_API_KEY` no Worker — some a busca, fica o link manual. */
  | { readonly status: 'not-configured' }
  | { readonly status: 'error'; readonly message: string };

export async function searchYoutube(query: string): Promise<YoutubeSearch> {
  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, {
      credentials: 'same-origin',
    });

    if (res.status === 501) return { status: 'not-configured' };

    const data = (await res.json().catch(() => ({}))) as {
      results?: YoutubeResult[];
      error?: string;
    };

    if (!res.ok) {
      return { status: 'error', message: data.error ?? 'Não foi possível buscar agora.' };
    }
    return { status: 'ok', results: data.results ?? [] };
  } catch {
    return { status: 'error', message: 'Sem conexão com o servidor.' };
  }
}
