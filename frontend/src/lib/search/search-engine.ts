import MiniSearch from 'minisearch';
import type { SongIndexEntry } from '@/types/library';

export class SearchEngine {
  private miniSearch: MiniSearch<SongIndexEntry>;

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
   * (Re)indexa a biblioteca inteira.
   *
   * Substitui o índice em vez de ignorar chamadas seguintes: a biblioteca muda
   * quando uma música é criada, editada ou excluída, e a busca precisa
   * refletir isso na hora.
   */
  init(songs: SongIndexEntry[]) {
    this.miniSearch.removeAll();
    this.miniSearch.addAll(songs);
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
