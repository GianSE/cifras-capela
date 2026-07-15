/**
 * @module parser
 * @description Parser que converte um fluxo de tokens ChordPro em uma AST
 * (Abstract Syntax Tree) do tipo Song. O parser é tolerante a erros — nunca
 * lança exceções, reportando problemas através da lista de ParseError.
 */

import type {
  Chord,
  Line,
  LineType,
  ParseError,
  ParseResult,
  Section,
  SectionType,
  Segment,
  Song,
  SongMetadata,
} from '@/types/song';
import type { Token } from './lexer';
import { tokenize } from './lexer';
import { parseChordString } from '@/lib/transpose/chord-parser';

// ---------------------------------------------------------------------------
// Parsing de acordes
// ---------------------------------------------------------------------------

/**
 * Analisa uma string de acorde em uma estrutura {@link Chord}.
 *
 * Delega ao parser de acordes reutilizável (`parseChordString`), garantindo
 * uma **única fonte de verdade** para o reconhecimento de acordes em todo o
 * sistema (parser, renderização e transposição usam o mesmo algoritmo).
 *
 * @param raw - Texto bruto do acorde (sem colchetes).
 * @returns {@link Chord} ou `undefined` se não for um acorde válido.
 */
export function parseChord(raw: string): Chord | undefined {
  return parseChordString(raw) ?? undefined;
}

// ---------------------------------------------------------------------------
// Processamento de metadados
// ---------------------------------------------------------------------------

/** Diretivas que mapeiam diretamente para campos de SongMetadata */
const METADATA_DIRECTIVES: ReadonlySet<string> = new Set([
  'title', 'subtitle', 'artist', 'key', 'tempo', 'time',
  'capo', 'album', 'year', 'copyright', 'category', 'categories',
  'tag', 'tags', 'language', 'lang',
]);

/**
 * Cria um objeto SongMetadata padrão (vazio).
 */
function createEmptyMetadata(): {
  title: string;
  artist?: string;
  key?: string;
  tempo?: number;
  time?: string;
  capo?: number;
  album?: string;
  year?: string;
  copyright?: string;
  tags?: string[];
  categories?: string[];
  category?: string;
  language?: string;
  custom: Record<string, string>;
} {
  return {
    title: '',
    custom: {},
  };
}

/**
 * Divide um valor de lista (`a, b` ou `[a, b]`) em itens individuais,
 * removendo colchetes e espaços em branco.
 */
function parseList(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Aplica uma diretiva aos metadados da música.
 *
 * @param metadata - Metadados mutáveis em construção
 * @param name - Nome da diretiva
 * @param value - Valor da diretiva
 * @param errors - Lista de erros para reportar problemas
 * @param lineNumber - Número da linha para mensagens de erro
 */
function applyDirective(
  metadata: ReturnType<typeof createEmptyMetadata>,
  name: string,
  value: string,
  errors: ParseError[],
  lineNumber: number,
): void {
  switch (name) {
    case 'title':
    case 't':
      metadata.title = value;
      break;
    case 'subtitle':
    case 'artist':
      metadata.artist = value;
      break;
    case 'key':
      metadata.key = value;
      break;
    case 'tempo': {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        errors.push({
          line: lineNumber,
          message: `Valor inválido para tempo: "${value}". Esperado um número inteiro (BPM).`,
          severity: 'warning',
        });
      } else {
        metadata.tempo = parsed;
      }
      break;
    }
    case 'time':
      metadata.time = value;
      break;
    case 'capo': {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        errors.push({
          line: lineNumber,
          message: `Valor inválido para capo: "${value}". Esperado um número inteiro.`,
          severity: 'warning',
        });
      } else {
        metadata.capo = parsed;
      }
      break;
    }
    case 'album':
      metadata.album = value;
      break;
    case 'year':
      metadata.year = value;
      break;
    case 'copyright':
      metadata.copyright = value;
      break;
    case 'category':
    case 'categories': {
      if (!metadata.categories) {
        metadata.categories = [];
      }
      metadata.categories.push(...parseList(value));
      // Mantém o campo singular para compatibilidade retroativa.
      if (name === 'category' && !metadata.category) {
        metadata.category = value;
      }
      break;
    }
    case 'language':
    case 'lang':
      metadata.language = value;
      break;
    case 'tag':
    case 'tags': {
      if (!metadata.tags) {
        metadata.tags = [];
      }
      metadata.tags.push(...parseList(value));
      break;
    }
    default:
      // Diretivas não reconhecidas vão para custom
      if (!METADATA_DIRECTIVES.has(name)) {
        metadata.custom[name] = value;
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Seções "amigáveis" (auto-fechadas)
// ---------------------------------------------------------------------------

/**
 * Palavras-chave (PT/EN) que marcam o início de uma seção de forma curta,
 * sem par de abertura/fechamento. Ex.: `{verso 1}`, `{refrão}`, `{ponte}`.
 * A seção anterior é fechada automaticamente ao encontrar a próxima.
 */
const SECTION_KEYWORDS: Readonly<Record<string, SectionType>> = {
  verse: 'verse',
  verso: 'verse',
  intro: 'verse',
  solo: 'verse',
  outro: 'verse',
  final: 'verse',
  interlude: 'verse',
  interludio: 'verse',
  chorus: 'chorus',
  refrao: 'chorus',
  'refrão': 'chorus',
  coro: 'chorus',
  estribilho: 'chorus',
  'pre-chorus': 'chorus',
  'pre-refrao': 'chorus',
  'pré-refrão': 'chorus',
  bridge: 'bridge',
  ponte: 'bridge',
  tab: 'tab',
  tablatura: 'tab',
  grid: 'grid',
};

/**
 * Monta o rótulo exibível de uma seção amigável a partir do nome da diretiva
 * e do valor. Ex.: `('verso', '1')` → `'Verso 1'`; `('refrão', '')` → `'Refrão'`.
 */
function buildSectionLabel(name: string, value: string): string {
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return value ? `${capitalized} ${value}` : capitalized;
}

// ---------------------------------------------------------------------------
// Classificação de linhas
// ---------------------------------------------------------------------------

/**
 * Classifica o tipo de uma linha com base em seus segmentos.
 *
 * @param segments - Segmentos da linha
 * @returns O tipo da linha
 */
function classifyLine(segments: Segment[]): LineType {
  if (segments.length === 0) return 'empty';

  const hasChords = segments.some((s) => s.chord !== undefined);
  const hasLyrics = segments.some((s) => s.lyric.trim().length > 0);

  if (hasChords && hasLyrics) return 'lyrics';
  if (hasChords) return 'chords-only';
  if (hasLyrics) return 'lyrics';
  return 'empty';
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

/**
 * Estado interno do parser durante o processamento dos tokens.
 */
interface ParserState {
  /** Metadados em construção */
  metadata: ReturnType<typeof createEmptyMetadata>;
  /** Seções acumuladas */
  sections: Section[];
  /** Linhas da seção atual */
  currentLines: Line[];
  /** Tipo da seção atual */
  currentSectionType: SectionType;
  /** Rótulo da seção atual */
  currentSectionLabel?: string;
  /** Segmentos da linha atual */
  currentSegments: Segment[];
  /** Erros acumulados */
  errors: ParseError[];
  /** Pilha de ambientes abertos (para validar aninhamento) */
  envStack: Array<{ type: SectionType; line: number }>;
}

/**
 * Cria o estado inicial do parser.
 */
function createInitialState(): ParserState {
  return {
    metadata: createEmptyMetadata(),
    sections: [],
    currentLines: [],
    currentSectionType: 'none',
    currentSectionLabel: undefined,
    currentSegments: [],
    errors: [],
    envStack: [],
  };
}

/**
 * Finaliza a linha atual e a adiciona à lista de linhas.
 */
function flushLine(state: ParserState): void {
  // Não adicionar linhas completamente vazias se não há segmentos
  const segments = state.currentSegments;
  state.currentSegments = [];

  if (segments.length === 0) {
    // Linha vazia
    state.currentLines.push({
      type: 'empty',
      segments: [],
    });
    return;
  }

  const lineType = classifyLine(segments);
  state.currentLines.push({
    type: lineType,
    segments,
  });
}

/**
 * Finaliza a seção atual e a adiciona à lista de seções.
 */
function flushSection(state: ParserState): void {
  // Flush qualquer linha pendente (sem NEWLINE final)
  if (state.currentSegments.length > 0) {
    flushLine(state);
  }

  if (state.currentLines.length > 0) {
    state.sections.push({
      type: state.currentSectionType,
      label: state.currentSectionLabel,
      lines: state.currentLines,
    });
  }

  state.currentLines = [];
  state.currentSectionType = 'none';
  state.currentSectionLabel = undefined;
}

/**
 * Processa um único token, atualizando o estado do parser.
 */
function processToken(state: ParserState, token: Token): void {
  switch (token.type) {
    case 'DIRECTIVE': {
      // Marcador de seção amigável (`{verso 1}`, `{refrão}`)? Auto-fecha a anterior.
      const sectionType = SECTION_KEYWORDS[token.name];
      if (sectionType) {
        flushSection(state);
        state.currentSectionType = sectionType;
        state.currentSectionLabel = buildSectionLabel(token.name, token.value);
      } else {
        applyDirective(state.metadata, token.name, token.value, state.errors, token.line);
      }
      break;
    }

    case 'ENV_START':
      // Finalizar seção anterior
      flushSection(state);
      state.currentSectionType = token.envType;
      state.currentSectionLabel = token.label;
      state.envStack.push({ type: token.envType, line: token.line });
      break;

    case 'ENV_END': {
      const openEnv = state.envStack.pop();
      if (!openEnv) {
        state.errors.push({
          line: token.line,
          message: `Fechamento de seção "${token.envType}" sem abertura correspondente.`,
          severity: 'warning',
        });
      } else if (openEnv.type !== token.envType) {
        state.errors.push({
          line: token.line,
          message: `Fechamento de seção "${token.envType}" não corresponde à abertura "${openEnv.type}" na linha ${openEnv.line}.`,
          severity: 'warning',
        });
      }
      flushSection(state);
      break;
    }

    case 'CHORD': {
      const chord = parseChord(token.value);
      if (chord) {
        // Adiciona segmento com acorde. A letra será preenchida pelo próximo LYRIC
        // ou ficará vazia se for um acorde sem letra.
        state.currentSegments.push({ chord, lyric: '' });
      } else {
        state.errors.push({
          line: token.line,
          message: `Acorde não reconhecido: "${token.value}".`,
          severity: 'warning',
        });
        // Tratar como texto
        state.currentSegments.push({ lyric: `[${token.value}]` });
      }
      break;
    }

    case 'LYRIC': {
      // Se o último segmento tem acorde e letra vazia, anexar a letra a ele.
      const lastSegment = state.currentSegments[state.currentSegments.length - 1];
      if (lastSegment?.chord && lastSegment.lyric === '') {
        // Substituir o segmento com a letra atualizada (imutabilidade)
        state.currentSegments[state.currentSegments.length - 1] = {
          chord: lastSegment.chord,
          lyric: token.value,
        };
      } else {
        // Segmento apenas com letra
        state.currentSegments.push({ lyric: token.value });
      }
      break;
    }

    case 'COMMENT':
      // Comentários viram uma linha de comentário
      if (state.currentSegments.length > 0) {
        flushLine(state);
      }
      state.currentLines.push({
        type: 'comment',
        segments: [],
        comment: token.value,
      });
      break;

    case 'NEWLINE':
      flushLine(state);
      break;
  }
}

/**
 * Analisa (parse) um texto ChordPro e produz uma AST do tipo Song.
 *
 * O parser é tolerante a erros — nunca lança exceções. Problemas
 * encontrados durante o parsing são reportados na lista de erros
 * do resultado.
 *
 * @param input - Texto completo no formato ChordPro
 * @returns ParseResult contendo a AST da música e eventuais erros
 *
 * @example
 * ```ts
 * const result = parse(`
 * {title: Porque Ele Vive}
 * {artist: Harpa Cristã}
 *
 * {start_of_verse: Verso 1}
 * [G]Deus enviou [C]Seu Filho [G]amado
 * {end_of_verse}
 * `);
 *
 * console.log(result.song.metadata.title); // "Porque Ele Vive"
 * console.log(result.song.sections.length); // 1
 * ```
 */
export function parse(input: string): ParseResult {
  const tokens = tokenize(input);
  const state = createInitialState();

  for (const token of tokens) {
    processToken(state, token);
  }

  // Finalizar qualquer seção pendente
  flushSection(state);

  // Verificar ambientes não fechados
  for (const openEnv of state.envStack) {
    state.errors.push({
      line: openEnv.line,
      message: `Seção "${openEnv.type}" aberta na linha ${openEnv.line} não foi fechada.`,
      severity: 'warning',
    });
  }

  // Aviso se não há título
  if (!state.metadata.title) {
    state.errors.push({
      line: 1,
      message: 'Título da música não definido. Use {title: Nome da Música}.',
      severity: 'warning',
    });
  }

  const song: Song = {
    metadata: state.metadata as SongMetadata,
    sections: state.sections,
  };

  return {
    song,
    errors: state.errors,
  };
}
