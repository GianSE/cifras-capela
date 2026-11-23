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

/**
 * Busca local: título, artista, categorias e tags.
 *
 * A **letra** não entra aqui. Ela saía no índice da biblioteca só para este
 * MiniSearch, e com a biblioteca perto de 15 mil cifras isso virou 12MB por
 * abertura do app e uma reindexação que travava o celular. Quem procura por um
 * trecho de letra agora é o banco, pelo FTS5 (`/api/songs/busca`), e o
 * `useLibrary` junta os dois resultados.
 *
 * Esta parte continua local de propósito: responde a cada tecla, sem rede, e é
 * o que ainda funciona com o app offline.
 */
export class SearchEngine {
  private miniSearch: MiniSearch<SongIndexEntry>;
  /** Evita reindexar quando a lista é a mesma de antes — toda vez que uma tela
   * monta, por exemplo. */
  private indexed: SongIndexEntry[] | null = null;

  constructor() {
    this.miniSearch = new MiniSearch({
      fields: ['title', 'artist', 'tags', 'categories'],
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
    if (songs === this.indexed) return;
    this.indexed = songs;
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
