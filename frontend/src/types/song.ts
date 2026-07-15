/**
 * @module types/song
 * @description Definições de tipos para a AST (Abstract Syntax Tree) de músicas
 * no formato ChordPro. Todos os tipos seguem o padrão de uniões discriminadas
 * e tipagem estrita do TypeScript.
 */

// ---------------------------------------------------------------------------
// Notas e Acordes
// ---------------------------------------------------------------------------

/**
 * Nomes das notas musicais na notação anglo-saxônica.
 * C = Dó, D = Ré, E = Mi, F = Fá, G = Sol, A = Lá, B = Si
 */
export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/**
 * Acidentes musicais: sustenido (#) ou bemol (b).
 */
export type Accidental = '#' | 'b';

/**
 * Representação de uma nota musical com raiz e acidente opcional.
 * Usada como nota do baixo em acordes invertidos (slash chords).
 */
export interface NoteDescriptor {
  /** Nota raiz (C, D, E, F, G, A, B) */
  readonly root: NoteName;
  /** Acidente opcional: sustenido ou bemol */
  readonly accidental?: Accidental;
}

/**
 * Estrutura completa de um acorde musical analisado.
 *
 * @example
 * // "Am7/G" seria representado como:
 * {
 *   root: 'A',
 *   accidental: undefined,
 *   quality: 'm',
 *   extensions: '7',
 *   bass: { root: 'G' },
 *   raw: 'Am7/G'
 * }
 *
 * @example
 * // "F#m7(b5)/E" seria representado como:
 * {
 *   root: 'F',
 *   accidental: '#',
 *   quality: 'm',
 *   extensions: '7(b5)',
 *   bass: { root: 'E' },
 *   raw: 'F#m7(b5)/E'
 * }
 */
export interface Chord {
  /** Nota raiz do acorde */
  readonly root: NoteName;
  /** Acidente da nota raiz (sustenido ou bemol) */
  readonly accidental?: Accidental;
  /**
   * Qualidade do acorde.
   * Valores comuns: '' (maior), 'm' (menor), 'min', 'maj', 'dim', 'aug',
   * 'sus', '+', '°'
   */
  readonly quality: string;
  /**
   * Extensões do acorde.
   * Exemplos: '7', '9', 'maj7', 'm7', 'add9', '7(b5)', '7(#9)', '11'
   */
  readonly extensions: string;
  /**
   * Nota do baixo para acordes invertidos (slash chords).
   * Ex: Em "C/G", bass seria { root: 'G' }
   */
  readonly bass?: NoteDescriptor;
  /** Texto original do acorde tal como escrito na cifra */
  readonly raw: string;
}

// ---------------------------------------------------------------------------
// Segmentos e Linhas
// ---------------------------------------------------------------------------

/**
 * Um segmento é a unidade básica de conteúdo: um acorde (opcional)
 * posicionado sobre um trecho de letra.
 *
 * @example
 * // "[Am]Porque Ele" → { chord: {...}, lyric: 'Porque Ele' }
 * // "vive" (sem acorde) → { chord: undefined, lyric: 'vive' }
 */
export interface Segment {
  /** Acorde associado a este segmento (pode ser ausente) */
  readonly chord?: Chord;
  /** Texto da letra associado a este segmento */
  readonly lyric: string;
}

/**
 * Classificação do tipo de linha na cifra.
 * - `'lyrics'` — Linha contendo letra (possivelmente com acordes)
 * - `'chords-only'` — Linha contendo apenas acordes, sem letra
 * - `'comment'` — Linha de comentário
 * - `'empty'` — Linha em branco
 */
export type LineType = 'lyrics' | 'chords-only' | 'comment' | 'empty';

/**
 * Representa uma única linha na cifra, classificada por tipo.
 */
export interface Line {
  /** Tipo da linha */
  readonly type: LineType;
  /** Segmentos de acorde+letra que compõem a linha */
  readonly segments: readonly Segment[];
  /** Texto do comentário (presente apenas quando type === 'comment') */
  readonly comment?: string;
}

// ---------------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------------

/**
 * Tipo de seção da música.
 * - `'verse'` — Estrofe
 * - `'chorus'` — Refrão
 * - `'bridge'` — Ponte
 * - `'tab'` — Tablatura
 * - `'grid'` — Grade de acordes
 * - `'none'` — Conteúdo fora de qualquer seção marcada
 */
export type SectionType = 'verse' | 'chorus' | 'bridge' | 'tab' | 'grid' | 'none';

/**
 * Uma seção agrupa linhas consecutivas que pertencem a uma mesma
 * parte da música (verso, refrão, ponte, etc.).
 */
export interface Section {
  /** Tipo da seção */
  readonly type: SectionType;
  /** Rótulo opcional exibido ao usuário, ex: 'Verso 1', 'Refrão' */
  readonly label?: string;
  /** Linhas que compõem esta seção */
  readonly lines: readonly Line[];
}

// ---------------------------------------------------------------------------
// Metadados
// ---------------------------------------------------------------------------

/**
 * Metadados extraídos das diretivas ChordPro da música.
 */
export interface SongMetadata {
  /** Título da música */
  readonly title: string;
  /** Nome do artista ou banda */
  readonly artist?: string;
  /** Tonalidade da música (ex: 'Am', 'C', 'G#m') */
  readonly key?: string;
  /** Andamento em BPM */
  readonly tempo?: number;
  /** Fórmula de compasso (ex: '4/4', '3/4', '6/8') */
  readonly time?: string;
  /** Posição do capotraste */
  readonly capo?: number;
  /** Nome do álbum */
  readonly album?: string;
  /** Ano de lançamento ou gravação */
  readonly year?: string;
  /** Informações de copyright */
  readonly copyright?: string;
  /** Tags/etiquetas livres para categorização */
  readonly tags?: readonly string[];
  /** Categorias da música (ex: 'culto', 'santa ceia', 'natal'). */
  readonly categories?: readonly string[];
  /**
   * Categoria única (legado ChordPro `{category: ...}`).
   * Prefira `categories`. Mantido para compatibilidade retroativa.
   */
  readonly category?: string;
  /** Idioma da letra (ex: 'pt', 'en', 'es'). */
  readonly language?: string;
  /** Diretivas personalizadas não reconhecidas */
  readonly custom: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// AST da Música
// ---------------------------------------------------------------------------

/**
 * Representação completa da AST (Abstract Syntax Tree) de uma música
 * no formato ChordPro. Esta é a estrutura de dados principal do sistema.
 */
export interface Song {
  /** Metadados da música */
  readonly metadata: SongMetadata;
  /** Seções que compõem o corpo da música */
  readonly sections: readonly Section[];
}

// ---------------------------------------------------------------------------
// Resultado do Parse
// ---------------------------------------------------------------------------

/**
 * Severidade de um erro encontrado durante o parsing.
 * - `'warning'` — Problema menor que não impede a interpretação
 * - `'error'` — Problema grave que pode causar perda de informação
 */
export type ParseSeverity = 'warning' | 'error';

/**
 * Representa um erro ou aviso encontrado durante o parsing de uma cifra.
 */
export interface ParseError {
  /** Número da linha onde o erro ocorreu (1-indexed) */
  readonly line: number;
  /** Mensagem descritiva do erro (em português) */
  readonly message: string;
  /** Severidade do erro */
  readonly severity: ParseSeverity;
}

/**
 * Resultado do parsing de um texto ChordPro. Contém a AST da música
 * e uma lista de erros/avisos encontrados durante o processo.
 * O parser nunca lança exceções — erros são sempre reportados aqui.
 */
export interface ParseResult {
  /** AST da música resultante do parsing */
  readonly song: Song;
  /** Lista de erros e avisos encontrados */
  readonly errors: readonly ParseError[];
}
