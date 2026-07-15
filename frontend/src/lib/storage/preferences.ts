/**
 * @module lib/storage/preferences
 * @description Persistência de preferências do usuário em localStorage
 * (favoritos, histórico, tema, tamanho de fonte, sustenidos/bemóis).
 *
 * Expõe um store observável (`subscribe`/`getSnapshot`) compatível com
 * `useSyncExternalStore`, e sincroniza entre abas via evento `storage`.
 */

export type ThemePreference = 'dark' | 'light' | 'system';

export interface UserPreferences {
  /** Preferir bemóis (Db) em vez de sustenidos (C#) na transposição. */
  readonly preferFlats: boolean;
  /** Tema da interface. */
  readonly theme: ThemePreference;
  /** IDs das músicas favoritas. */
  readonly favorites: readonly string[];
  /** IDs das músicas abertas recentemente (mais recente primeiro, máx. 30). */
  readonly recentSongs: readonly string[];
  /** Tamanho da fonte da letra (px). */
  readonly fontSize: number;
  /** Velocidade padrão do auto-scroll (0.25–3). */
  readonly autoScrollSpeed: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  preferFlats: false,
  theme: 'dark',
  favorites: [],
  recentSongs: [],
  fontSize: 18,
  autoScrollSpeed: 1,
};

const STORAGE_KEY = 'cifras-capela:preferences';
const MAX_RECENTS = 30;

class PreferencesStorage {
  private prefs: UserPreferences;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.prefs = this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
          this.prefs = this.load();
          this.notify();
        }
      });
    }
  }

  private load(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...(JSON.parse(stored) as Partial<UserPreferences>) };
      }
    } catch (e) {
      console.warn('Falha ao carregar preferências do localStorage', e);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch (e) {
      console.warn('Falha ao salvar preferências no localStorage', e);
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** Assina mudanças. Retorna a função de cancelamento. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Snapshot imutável atual (identidade muda a cada atualização). */
  readonly getSnapshot = (): UserPreferences => this.prefs;

  /** Atualização parcial e imutável das preferências. */
  update(partial: Partial<UserPreferences>): void {
    this.prefs = { ...this.prefs, ...partial };
    this.save();
    this.notify();
  }

  addRecentSong(songId: string): void {
    const recents = [songId, ...this.prefs.recentSongs.filter((id) => id !== songId)].slice(
      0,
      MAX_RECENTS,
    );
    this.update({ recentSongs: recents });
  }

  clearRecents(): void {
    this.update({ recentSongs: [] });
  }

  toggleFavorite(songId: string): void {
    const favorites = this.prefs.favorites.includes(songId)
      ? this.prefs.favorites.filter((id) => id !== songId)
      : [...this.prefs.favorites, songId];
    this.update({ favorites });
  }

  isFavorite(songId: string): boolean {
    return this.prefs.favorites.includes(songId);
  }
}

export const preferencesStorage = new PreferencesStorage();
