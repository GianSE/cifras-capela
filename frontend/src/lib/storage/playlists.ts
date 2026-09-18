/**
 * @module lib/storage/playlists
 * @description Persistência das playlists (setlists).
 *
 * Store observável (`subscribe`/`getSnapshot`) compatível com
 * `useSyncExternalStore`, mesmo padrão de `preferences.ts`.
 *
 * Sem login: fica só no `localStorage`,
 * sincronizado entre abas do mesmo aparelho. Logado, passa a espelhar a
 * tabela `playlists` do D1 — assim uma playlist montada no celular
 * aparece ao abrir no tablet. O `localStorage` continua servindo de cache
 * (deixa a UI instantânea; escreve no servidor em segundo plano) e de
 * fallback caso a rede caia.
 */

import type { Playlist } from '@/types/playlist';
import { deleteRemotePlaylist, fetchRemotePlaylists, pushPlaylist } from './playlist-sync';

const STORAGE_KEY = 'cifras-capela:playlists';

/** Gera um ID curto e estável (sem dependências). */
function createId(): string {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

class PlaylistStorage {
  private playlists: readonly Playlist[];
  private readonly listeners = new Set<() => void>();

  /** `null` = modo local (sem login). Com sessão, vira o dono das linhas remotas. */
  private userId: string | null = null;

  constructor() {
    this.playlists = this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && !this.userId) {
          this.playlists = this.load();
          this.notify();
        }
      });
    }
  }

  /**
   * Avisa quem está logado. Chamado pelo `useAuth` — o cookie de sessão é
   * httpOnly, então não há como este módulo descobrir isso sozinho.
   */
  readonly setSession = (userId: number | null): void => {
    const next = userId === null ? null : String(userId);
    if (next === this.userId) return;
    this.userId = next;

    if (next) {
      void this.syncFromRemote();
    } else {
      // Logout: volta a refletir só o que está salvo neste aparelho.
      this.playlists = this.load();
      this.notify();
    }
  };

  private load(): readonly Playlist[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Playlist[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Falha ao carregar playlists do localStorage', e);
    }
    return [];
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.playlists));
    } catch (e) {
      console.warn('Falha ao salvar playlists no localStorage', e);
    }
  }

  private commit(next: readonly Playlist[]): void {
    this.playlists = next;
    this.save();
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** Aplica uma transformação a uma playlist e atualiza `updatedAt`. Devolve a versão nova. */
  private patch(id: string, fn: (playlist: Playlist) => Playlist): Playlist | undefined {
    let updated: Playlist | undefined;
    this.commit(
      this.playlists.map((p) => {
        if (p.id !== id) return p;
        updated = { ...fn(p), updatedAt: now() };
        return updated;
      }),
    );
    return updated;
  }

  /**
   * Ao logar: busca as playlists remotas. Se a conta ainda não tem nenhuma e
   * este aparelho tem playlists locais, sobe elas uma vez (só acontece no
   * primeiro login). Depois disso, o servidor manda.
   */
  private async syncFromRemote(): Promise<void> {
    const remote = await fetchRemotePlaylists();
    if (remote === null) return; // Offline: segue com o que há neste aparelho.

    if (remote.length === 0 && this.playlists.length > 0) {
      // Primeiro login neste acervo: sobe o que já existia no aparelho.
      const local = this.playlists;
      await Promise.all(local.map((playlist) => pushPlaylist(playlist)));
      return;
    }

    this.commit(remote);
  }

  /** Espelha uma mutação local na API, se logado. Falha em silêncio (offline-first). */
  private persist(op: () => Promise<boolean>): void {
    if (!this.userId) return;
    void op().then((ok) => {
      if (!ok) console.warn('Falha ao sincronizar a playlist com o servidor.');
    });
  }

  /** Sobe a playlist inteira — a API grava por upsert, então serve para tudo. */
  private push(id: string): void {
    const playlist = this.playlists.find((p) => p.id === id);
    if (playlist) this.persist(() => pushPlaylist(playlist));
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): readonly Playlist[] => this.playlists;

  get(id: string): Playlist | undefined {
    return this.playlists.find((p) => p.id === id);
  }

  /** Cria uma playlist e devolve seu ID. */
  create(name: string, songIds: readonly string[] = []): string {
    const id = createId();
    const timestamp = now();
    const playlist: Playlist = {
      id,
      name: name.trim() || 'Nova playlist',
      songIds: [...songIds],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.commit([...this.playlists, playlist]);
    this.persist(() => pushPlaylist(playlist));
    return id;
  }

  rename(id: string, name: string): void {
    this.patch(id, (p) => ({ ...p, name: name.trim() || p.name }));
    this.push(id);
  }

  remove(id: string): void {
    this.commit(this.playlists.filter((p) => p.id !== id));
    this.persist(() => deleteRemotePlaylist(id));
  }

  /** Adiciona a música ao fim (ignora duplicatas). */
  addSong(id: string, songId: string): void {
    const updated = this.patch(id, (p) =>
      p.songIds.includes(songId) ? p : { ...p, songIds: [...p.songIds, songId] },
    );
    this.persistSongIds(id, updated);
  }

  removeSong(id: string, songId: string): void {
    const updated = this.patch(id, (p) => ({
      ...p,
      songIds: p.songIds.filter((s) => s !== songId),
    }));
    this.persistSongIds(id, updated);
  }

  /** Substitui a ordem inteira (usado pelo arrastar-e-soltar). */
  reorder(id: string, songIds: readonly string[]): void {
    const updated = this.patch(id, (p) => ({ ...p, songIds: [...songIds] }));
    this.persistSongIds(id, updated);
  }

  /** Move uma música de uma posição para outra, preservando as demais. */
  move(id: string, from: number, to: number): void {
    const updated = this.patch(id, (p) => {
      const songIds = [...p.songIds];
      const [moved] = songIds.splice(from, 1);
      if (moved === undefined) return p;
      songIds.splice(to, 0, moved);
      return { ...p, songIds };
    });
    this.persistSongIds(id, updated);
  }

  private persistSongIds(id: string, updated: Playlist | undefined): void {
    if (updated) this.push(id);
  }

  /** True se a música já está na playlist. */
  has(id: string, songId: string): boolean {
    return this.get(id)?.songIds.includes(songId) ?? false;
  }
}

export const playlistStorage = new PlaylistStorage();
