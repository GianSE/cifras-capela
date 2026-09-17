import { useEffect, useState } from 'react';
import { fetchPlaylist, type PlaylistLookup } from '@/lib/storage/playlist-sync';

export type RemotePlaylistState = PlaylistLookup | { readonly status: 'loading' | 'idle' };

/**
 * Última resposta por id. O leitor troca de música dentro da playlist a cada
 * swipe, e cada troca remonta a página — sem isto, cada uma refaria a busca e
 * a navegação do setlist piscaria até a resposta chegar.
 */
const cache = new Map<string, PlaylistLookup>();

/**
 * Playlist aberta por link que **não** está neste aparelho — a compartilhada
 * de outra pessoa. Só busca quando `enabled` (quem já tem a playlist local não
 * precisa ir ao servidor).
 */
export function useRemotePlaylist(id: string | undefined, enabled: boolean): RemotePlaylistState {
  const [state, setState] = useState<RemotePlaylistState>(() =>
    id && enabled ? (cache.get(id) ?? { status: 'loading' }) : { status: 'idle' },
  );

  useEffect(() => {
    if (!id || !enabled) {
      setState({ status: 'idle' });
      return;
    }

    let active = true;
    const cached = cache.get(id);
    setState(cached ?? { status: 'loading' });

    // Mesmo com cache, confere de novo: o dono pode ter reordenado ou
    // desligado o compartilhamento desde a última vez.
    void fetchPlaylist(id).then((result) => {
      if (!active) return;
      // Falha de rede não apaga o que já estava em cache (segue tocando offline).
      if (result.status === 'error' && cached) return;
      if (result.status !== 'error') cache.set(id, result);
      setState(result);
    });

    return () => {
      active = false;
    };
  }, [id, enabled]);

  return state;
}
