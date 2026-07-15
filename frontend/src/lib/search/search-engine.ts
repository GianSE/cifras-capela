import MiniSearch from 'minisearch';
import type { SongIndexEntry } from '@/types/library';

export class SearchEngine {
  private miniSearch: MiniSearch<SongIndexEntry>;
  private isInitialized = false;

  constructor() {
    this.miniSearch = new MiniSearch({
      fields: ['title', 'artist', 'tags', 'categories', 'lyrics'],
      storeFields: [
        'id',
        'title',
        'artist',
        'key',
        'categories',
        'tags',
        'language',
        'tempo',
        'filename',
      ],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 4, artist: 2, categories: 1.5, tags: 1.5 },
      },
    });
  }

  /**
   * Initializes the search engine with the song index.
   */
  init(songs: SongIndexEntry[]) {
    if (this.isInitialized) return;
    this.miniSearch.addAll(songs);
    this.isInitialized = true;
  }

  /**
   * Searches the song index.
   */
  search(query: string): SongIndexEntry[] {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const results = this.miniSearch.search(query);
    
    // We map back to the original objects stored in minisearch
    // or return the raw results from minisearch as they include storeFields.
    return results as unknown as SongIndexEntry[];
  }
}

export const searchEngine = new SearchEngine();
