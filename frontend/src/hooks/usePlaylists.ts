import { useSyncExternalStore } from 'react';
import { playlistStorage } from '@/lib/storage/playlists';
import type { Playlist } from '@/types/playlist';

/**
 * Assina todas as playlists. Reativo entre componentes e entre abas.
 * As ações vivem em `playlistStorage` (não precisam de estado local).
 */
export function usePlaylists(): readonly Playlist[] {
  return useSyncExternalStore(
    playlistStorage.subscribe,
    playlistStorage.getSnapshot,
    playlistStorage.getSnapshot,
  );
}

/** Assina uma playlist específica. */
export function usePlaylist(id: string | undefined): Playlist | undefined {
  const playlists = usePlaylists();
  return id ? playlists.find((p) => p.id === id) : undefined;
}
