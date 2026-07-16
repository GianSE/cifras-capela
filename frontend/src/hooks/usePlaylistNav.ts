import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { usePlaylist } from './usePlaylists';

export interface PlaylistNav {
  /** Playlist ativa (quando o leitor foi aberto a partir de uma). */
  readonly playlistId?: string;
  readonly playlistName?: string;
  /** Posição da música atual (1-indexed) e total. */
  readonly position: number;
  readonly total: number;
  /** Caminhos para navegar mantendo o contexto da playlist. */
  readonly prevHref?: string;
  readonly nextHref?: string;
}

/**
 * Contexto de playlist no leitor.
 *
 * O leitor sabe que faz parte de um setlist pela query `?playlist=<id>`, o que
 * mantém a URL compartilhável e o estado fora do componente.
 */
export function usePlaylistNav(songId: string): PlaylistNav | null {
  const [params] = useSearchParams();
  const playlistId = params.get('playlist') ?? undefined;
  const playlist = usePlaylist(playlistId);

  return useMemo(() => {
    if (!playlist) return null;

    const index = playlist.songIds.indexOf(songId);
    if (index === -1) return null;

    const href = (id: string) => `/musica/${id}?playlist=${playlist.id}`;
    const prev = playlist.songIds[index - 1];
    const next = playlist.songIds[index + 1];

    return {
      playlistId: playlist.id,
      playlistName: playlist.name,
      position: index + 1,
      total: playlist.songIds.length,
      ...(prev && { prevHref: href(prev) }),
      ...(next && { nextHref: href(next) }),
    };
  }, [playlist, songId]);
}
