import MiniSearch from 'minisearch';
import type { SongIndexEntry } from '@/types/library';

/**
 * Normaliza um termo para o índice e para a consulta: minúsculas e **sem
 * acento**.
 *
 * No celular quase ninguém digita acento, e o repertório é cheio deles
 * ("coração", "não", "louvação"). Sem dobrar os diacríticos, a busca só
 * acertava por acaso: o `fuzzy` abaixo tolera uma correção, então "amem"
 * achava "Amém" (1 troca) mas "coracao" não achava "coração" (2 trocas).
 *
 * `NFD` separa a letra do acento, e a faixa U+0300–U+036F (as marcas
 * combinantes) apaga o acento e deixa a letra — o cedilha vira "c".
 */
function foldTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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
      // Vale para a indexação e, por herança, para a consulta — as duas
      // pontas precisam da mesma normalização para se encontrarem.
      processTerm: foldTerm,
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

  /** Busca no índice; devolve as entradas na ordem de relevância. */
  search(query: string): SongIndexEntry[] {
    if (!query || query.trim() === '') {
      return [];
    }

    // Os resultados trazem os `storeFields`, que são a própria entrada.
    return this.miniSearch.search(query) as unknown as SongIndexEntry[];
  }
}

export const searchEngine = new SearchEngine();
