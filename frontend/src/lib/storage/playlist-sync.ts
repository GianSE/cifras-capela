/**
 * @module lib/storage/playlist-sync
 * @description Conversas com `/api/playlists` — a cópia das playlists no D1.
 *
 * As playlists continuam morando no localStorage; isto aqui só espelha, para
 * o mesmo repertório abrir no celular e no PC. Toda função falha em silêncio
 * (devolve `null`/`false`): perder a sincronia não pode impedir alguém de
 * montar um setlist offline.
 */

import type { Playlist } from '@/types/playlist';

interface RemotePlaylist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Playlists da conta logada, ou `null` se a API não respondeu. */
export async function fetchRemotePlaylists(): Promise<Playlist[] | null> {
  try {
    const res = await fetch('/api/playlists', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = (await res.json()) as { playlists: RemotePlaylist[] };
    return data.playlists.map((p) => ({
      id: p.id,
      name: p.name,
      songIds: p.songIds,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  } catch {
    return null;
  }
}

/** Grava (cria ou atualiza) uma playlist na conta logada. */
export async function pushPlaylist(playlist: Playlist): Promise<boolean> {
  try {
    const res = await fetch(`/api/playlists/${encodeURIComponent(playlist.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: playlist.name,
        songIds: [...playlist.songIds],
        createdAt: playlist.createdAt,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteRemotePlaylist(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/playlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    return res.ok;
  } catch {
    return false;
  }
}
