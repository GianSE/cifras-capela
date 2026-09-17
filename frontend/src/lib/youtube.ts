/**
 * @module lib/youtube
 * @description Vídeo de referência da música no YouTube.
 *
 * A música guarda só o **id** do vídeo (11 caracteres) no campo `youtube` do
 * frontmatter. Aqui ficam a leitura de links colados, os endereços derivados
 * (player, miniatura, busca) e a edição do campo dentro do `.cho`.
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extrai o id de um link do YouTube ou aceita o id puro. Entende os formatos
 * que aparecem ao copiar do app ou do navegador: `watch?v=`, `youtu.be/`,
 * `shorts/`, `embed/`, `live/` e o `music.youtube.com`.
 */
export function parseYoutubeId(input: string | undefined | null): string | undefined {
  const value = input?.trim();
  if (!value) return undefined;
  if (VIDEO_ID_RE.test(value)) return value;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return undefined;
  }

  const host = url.hostname.toLowerCase().replace(/^(?:www|m|music)\./, '');
  let id: string | undefined;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      url.searchParams.get('v') ??
      url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
  }
  return id && VIDEO_ID_RE.test(id) ? id : undefined;
}

/**
 * Player embutido. O domínio `youtube-nocookie` só grava cookies quando a
 * pessoa dá play; `playsinline` impede o iPhone de abrir em tela cheia.
 */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
}

/** Miniatura 320×180 — leve o bastante para listas. */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

/** Busca no YouTube por título + artista, para achar o vídeo à mão. */
export function youtubeSearchUrl(title: string, artist?: string): string {
  const query = [title, artist].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/**
 * Grava (ou remove, com `id` vazio) o vídeo dentro do `.cho`, mexendo só na
 * linha do campo — reescrever o arquivo inteiro pelo serializador mudaria a
 * formatação de quem escreveu a cifra à mão.
 */
export function setYoutubeInSource(source: string, id: string | undefined): string {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);

  if (lines[0]?.trim() === '---') {
    const closing = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (closing > 0) {
      const header = lines.slice(1, closing).filter((line) => !/^\s*youtube\s*:/i.test(line));
      if (id) header.push(`youtube: ${id}`);
      return ['---', ...header, ...lines.slice(closing)].join(newline);
    }
  }

  // ChordPro puro: diretiva `{youtube: ...}` logo no topo.
  const body = lines.filter((line) => !/^\s*\{\s*youtube\s*:[^}]*\}\s*$/i.test(line));
  return (id ? [`{youtube: ${id}}`, ...body] : body).join(newline);
}
