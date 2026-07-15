import type { SongIndexEntry } from '@/types/library';

class SongService {
  private indexCache: SongIndexEntry[] | null = null;
  private fetchPromise: Promise<SongIndexEntry[]> | null = null;

  /**
   * Fetches the global song index generated at build time.
   * Results are cached in memory for the lifetime of the session.
   */
  async getSongIndex(): Promise<SongIndexEntry[]> {
    if (this.indexCache) {
      return this.indexCache;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = fetch('/songs/index.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch song index');
        return res.json() as Promise<SongIndexEntry[]>;
      })
      .then((index) => {
        this.indexCache = index;
        return index;
      })
      .catch((err) => {
        console.error('Error fetching song index:', err);
        return [];
      })
      .finally(() => {
        this.fetchPromise = null;
      });

    return this.fetchPromise;
  }

  /**
   * Fetches the raw ChordPro text for a given song ID.
   * @param id The song ID (e.g. 'harpa-crista/porque-ele-vive')
   */
  async getSongContent(id: string): Promise<string> {
    const response = await fetch(`/songs/${id}.cho`);
    if (!response.ok) {
      throw new Error(`Failed to fetch song content for ID: ${id}`);
    }
    return await response.text();
  }
}

export const songService = new SongService();
