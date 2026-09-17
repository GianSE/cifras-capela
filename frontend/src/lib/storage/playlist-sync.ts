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
  shared?: boolean;
  createdAt: string;
  updatedAt: string;
}

function fromRemote(p: RemotePlaylist): Playlist {
  return {
    id: p.id,
    name: p.name,
    songIds: p.songIds,
    shared: p.shared === true,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Playlists da conta logada, ou `null` se a API não respondeu. */
export async function fetchRemotePlaylists(): Promise<Playlist[] | null> {
  try {
    const res = await fetch('/api/playlists', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = (await res.json()) as { playlists: RemotePlaylist[] };
    return data.playlists.map(fromRemote);
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
        shared: playlist.shared === true,
        createdAt: playlist.createdAt,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Resultado de abrir uma playlist pelo link. */
export type PlaylistLookup =
  | { readonly status: 'found'; readonly playlist: Playlist; readonly isOwner: boolean }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' };

/**
 * Busca uma playlist pelo id — a de outra pessoa só vem se estiver
 * compartilhada. Diferencia "não existe/não compartilhada" de falha de rede,
 * para a tela não dizer que a playlist sumiu quando só caiu a conexão.
 */
export async function fetchPlaylist(id: string): Promise<PlaylistLookup> {
  try {
    const res = await fetch(`/api/playlists/${encodeURIComponent(id)}`, {
      credentials: 'same-origin',
    });
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) return { status: 'error' };
    const data = (await res.json()) as { playlist: RemotePlaylist; isOwner: boolean };
    return { status: 'found', playlist: fromRemote(data.playlist), isOwner: data.isOwner };
  } catch {
    return { status: 'error' };
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
