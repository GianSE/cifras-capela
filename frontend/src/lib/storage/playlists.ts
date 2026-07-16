/**
 * @module lib/storage/playlists
 * @description Persistência das playlists (setlists) em localStorage.
 *
 * Store observável (`subscribe`/`getSnapshot`) compatível com
 * `useSyncExternalStore`, com sincronização entre abas — mesmo padrão de
 * `preferences.ts`. Todas as operações são imutáveis.
 */

import type { Playlist } from '@/types/playlist';

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

  constructor() {
    this.playlists = this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
          this.playlists = this.load();
          this.notify();
        }
      });
    }
  }

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

  /** Aplica uma transformação a uma playlist e atualiza `updatedAt`. */
  private patch(id: string, fn: (playlist: Playlist) => Playlist): void {
    this.commit(
      this.playlists.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p)),
    );
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
    this.commit([
      ...this.playlists,
      { id, name: name.trim() || 'Nova playlist', songIds: [...songIds], createdAt: timestamp, updatedAt: timestamp },
    ]);
    return id;
  }

  rename(id: string, name: string): void {
    this.patch(id, (p) => ({ ...p, name: name.trim() || p.name }));
  }

  remove(id: string): void {
    this.commit(this.playlists.filter((p) => p.id !== id));
  }

  /** Adiciona a música ao fim (ignora duplicatas). */
  addSong(id: string, songId: string): void {
    this.patch(id, (p) =>
      p.songIds.includes(songId) ? p : { ...p, songIds: [...p.songIds, songId] },
    );
  }

  removeSong(id: string, songId: string): void {
    this.patch(id, (p) => ({ ...p, songIds: p.songIds.filter((s) => s !== songId) }));
  }

  /** Substitui a ordem inteira (usado pelo arrastar-e-soltar). */
  reorder(id: string, songIds: readonly string[]): void {
    this.patch(id, (p) => ({ ...p, songIds: [...songIds] }));
  }

  /** Move uma música de uma posição para outra, preservando as demais. */
  move(id: string, from: number, to: number): void {
    this.patch(id, (p) => {
      const songIds = [...p.songIds];
      const [moved] = songIds.splice(from, 1);
      if (moved === undefined) return p;
      songIds.splice(to, 0, moved);
      return { ...p, songIds };
    });
  }

  /** True se a música já está na playlist. */
  has(id: string, songId: string): boolean {
    return this.get(id)?.songIds.includes(songId) ?? false;
  }
}

export const playlistStorage = new PlaylistStorage();
