/**
 * @module lexer
 * @description Tokenizador (lexer) para o formato ChordPro.
 * Converte texto bruto em um fluxo de tokens tipados que serão
 * consumidos pelo parser.
 */

import type { SectionType } from '@/types/song';

// ---------------------------------------------------------------------------
// Token Types
// ---------------------------------------------------------------------------

/** Token de diretiva ChordPro: `{name: value}` */
export interface DirectiveToken {
  readonly type: 'DIRECTIVE';
  /** Nome normalizado da diretiva (ex: 'title', 'artist') */
  readonly name: string;
  /** Valor da diretiva (pode ser string vazia) */
  readonly value: string;
  /** Número da linha de origem (1-indexed) */
  readonly line: number;
}

/** Token de acorde: `[Am7]` */
export interface ChordToken {
  readonly type: 'CHORD';
  /** Texto do acorde sem os colchetes */
  readonly value: string;
  /** Número da linha de origem (1-indexed) */
  readonly line: number;
}

/** Token de texto (letra) */
export interface LyricToken {
  readonly type: 'LYRIC';
  /** Texto da letra */
  readonly value: string;
  /** Número da linha de origem (1-indexed) */
  readonly line: number;
}

/** Token de quebra de linha */
export interface NewlineToken {
  readonly type: 'NEWLINE';
  /** Número da linha de origem (1-indexed) */
  readonly line: number;
}

/** Token de comentário: `# texto` */
export interface CommentToken {
  readonly type: 'COMMENT';
  /** Texto do comentário sem o prefixo `#` */
  readonly value: string;
  /** Número da linha de origem (1-indexed) */
  readonly line: number;
}

/** Token de início de ambiente/seção: `{start_of_chorus}` */
export interface EnvStartToken {
  readonly type: 'ENV_START';
  /** Tipo do ambiente (verse, chorus, bridge, tab, grid) */
  readonly envType: SectionType;
  /** Rótulo opcional (ex: 'Verso 1') */
  readonly label?: string;
  /** Número da linha de origem (1-indexed) */
  readonly line: number;
}

/** Token de fim de ambiente/seção: `{end_of_chorus}` */
export interface EnvEndToken {
  readonly type: 'ENV_END';
  /** Tipo do ambiente que está sendo encerrado */
  readonly envType: SectionType;
  /** Número da linha de origem (1-indexed) */
  readonly line: number;
}

/**
 * União discriminada de todos os tipos de token.
 * O campo `type` é o discriminador.
 */
export type Token =
  | DirectiveToken
  | ChordToken
  | LyricToken
  | NewlineToken
  | CommentToken
  | EnvStartToken
  | EnvEndToken;

// ---------------------------------------------------------------------------
// Mapeamento de formas curtas → formas longas
// ---------------------------------------------------------------------------

/**
 * Mapeia abreviações de diretivas ChordPro para suas formas canônicas.
 */
const SHORT_DIRECTIVES: Readonly<Record<string, string>> = {
  t: 'title',
  st: 'subtitle',
  a: 'artist',
  c: 'comment',
  ci: 'comment_italic',
  cb: 'comment_box',
  bpm: 'tempo',
  lang: 'language',
  soc: 'start_of_chorus',
  eoc: 'end_of_chorus',
  sov: 'start_of_verse',
  eov: 'end_of_verse',
  sob: 'start_of_bridge',
  eob: 'end_of_bridge',
  sot: 'start_of_tab',
  eot: 'end_of_tab',
  sog: 'start_of_grid',
  eog: 'end_of_grid',
};

/**
 * Mapeia nomes de diretivas `start_of_*` para seus tipos de seção.
 */
const ENV_START_MAP: Readonly<Record<string, SectionType>> = {
  start_of_chorus: 'chorus',
  start_of_verse: 'verse',
  start_of_bridge: 'bridge',
  start_of_tab: 'tab',
  start_of_grid: 'grid',
};

/**
 * Mapeia nomes de diretivas `end_of_*` para seus tipos de seção.
 */
const ENV_END_MAP: Readonly<Record<string, SectionType>> = {
  end_of_chorus: 'chorus',
  end_of_verse: 'verse',
  end_of_bridge: 'bridge',
  end_of_tab: 'tab',
  end_of_grid: 'grid',
};

// ---------------------------------------------------------------------------
// Normalização de diretivas
// ---------------------------------------------------------------------------

/**
 * Normaliza o nome de uma diretiva: converte para minúscula,
 * expande abreviações.
 */
function normalizeDirectiveName(name: string): string {
  const lower = name.trim().toLowerCase();
  return SHORT_DIRECTIVES[lower] ?? lower;
}

// ---------------------------------------------------------------------------
// Tokenização de uma linha
// ---------------------------------------------------------------------------

/**
 * Regex para identificar diretivas no formato `{nome}` ou `{nome: valor}` ou `{nome valor}`.
 * Captura: grupo 1 = nome, grupo 2 = valor (opcional).
 */
const DIRECTIVE_REGEX = /^\{([^:}\s]+)(?:[:\s]\s*(.*?))?\}$/;

/**
 * Tokeniza uma única linha de texto ChordPro.
 *
 * @param rawLine - Texto bruto da linha
 * @param lineNumber - Número da linha (1-indexed)
 * @returns Array de tokens extraídos da linha
 */
function tokenizeLine(rawLine: string, lineNumber: number): Token[] {
  const tokens: Token[] = [];
  const trimmed = rawLine.trim();

  // Linha vazia → apenas NEWLINE
  if (trimmed === '') {
    return tokens;
  }

  // Comentário: linhas que começam com #
  if (trimmed.startsWith('#')) {
    tokens.push({
      type: 'COMMENT',
      value: trimmed.slice(1).trim(),
      line: lineNumber,
    });
    return tokens;
  }

  // Diretiva: `{...}`
  const directiveMatch = DIRECTIVE_REGEX.exec(trimmed);
  if (directiveMatch) {
    const rawName = directiveMatch[1]!;
    const rawValue = directiveMatch[2] ?? '';
    const normalizedName = normalizeDirectiveName(rawName);

    // Verificar se é início de ambiente
    const envStartType = ENV_START_MAP[normalizedName];
    if (envStartType !== undefined) {
      tokens.push({
        type: 'ENV_START',
        envType: envStartType,
        label: rawValue || undefined,
        line: lineNumber,
      });
      return tokens;
    }

    // Verificar se é fim de ambiente
    const envEndType = ENV_END_MAP[normalizedName];
    if (envEndType !== undefined) {
      tokens.push({
        type: 'ENV_END',
        envType: envEndType,
        line: lineNumber,
      });
      return tokens;
    }

    // Diretiva genérica
    tokens.push({
      type: 'DIRECTIVE',
      name: normalizedName,
      value: rawValue,
      line: lineNumber,
    });
    return tokens;
  }

  // Linha de conteúdo: pode conter acordes [X] intercalados com letra
  tokenizeContentLine(rawLine, lineNumber, tokens);

  return tokens;
}

/**
 * Tokeniza uma linha de conteúdo que pode conter acordes `[...]`
 * intercalados com texto.
 *
 * @param rawLine - Texto bruto da linha (preservando espaços)
 * @param lineNumber - Número da linha (1-indexed)
 * @param tokens - Array de tokens para acumular resultados
 */
function tokenizeContentLine(rawLine: string, lineNumber: number, tokens: Token[]): void {
  // Regex global para encontrar acordes entre colchetes
  const chordRegex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = chordRegex.exec(rawLine)) !== null) {
    // Texto antes do acorde
    if (match.index > lastIndex) {
      const lyricText = rawLine.slice(lastIndex, match.index);
      if (lyricText.length > 0) {
        tokens.push({
          type: 'LYRIC',
          value: lyricText,
          line: lineNumber,
        });
      }
    }

    // O acorde em si
    tokens.push({
      type: 'CHORD',
      value: match[1]!,
      line: lineNumber,
    });

    lastIndex = match.index + match[0].length;
  }

  // Texto restante após o último acorde
  if (lastIndex < rawLine.length) {
    const remaining = rawLine.slice(lastIndex);
    if (remaining.length > 0) {
      tokens.push({
        type: 'LYRIC',
        value: remaining,
        line: lineNumber,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Frontmatter YAML
// ---------------------------------------------------------------------------

/** Remove aspas simples/duplas ao redor de um valor. */
function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

/**
 * Detecta e processa um bloco de frontmatter YAML (`---`) no topo do arquivo.
 *
 * Suporta:
 *  - `chave: valor`
 *  - `chave: [a, b, c]` (lista inline)
 *  - lista em bloco:
 *    ```yaml
 *    categories:
 *      - culto
 *      - santa ceia
 *    ```
 *
 * Cada par vira um {@link DirectiveToken}, injetado antes dos tokens do corpo.
 * Se não houver frontmatter válido (com abertura e fechamento `---`), o corpo
 * é tokenizado a partir da linha 0 (compatível com ChordPro puro).
 *
 * @returns As diretivas extraídas e o índice (0-based) da primeira linha do corpo.
 */
function parseFrontmatter(lines: readonly string[]): {
  directives: DirectiveToken[];
  bodyStart: number;
} {
  if (lines[0]?.trim() !== '---') {
    return { directives: [], bodyStart: 0 };
  }

  let closing = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === '---') {
      closing = i;
      break;
    }
  }
  if (closing === -1) {
    return { directives: [], bodyStart: 0 };
  }

  const directives: DirectiveToken[] = [];
  let i = 1;

  while (i < closing) {
    const line = lines[i]!;
    const lineNumber = i + 1;
    i++;

    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const name = normalizeDirectiveName(line.slice(0, colon));
    let value = stripQuotes(line.slice(colon + 1).trim());

    // Lista em bloco: `chave:` seguido de linhas `- item`.
    if (value === '') {
      const items: string[] = [];
      while (i < closing) {
        const next = lines[i]!.trim();
        if (next.startsWith('- ')) {
          items.push(stripQuotes(next.slice(2).trim()));
          i++;
        } else if (next === '') {
          i++;
        } else {
          break;
        }
      }
      if (items.length > 0) {
        value = items.join(', ');
      }
    }

    directives.push({ type: 'DIRECTIVE', name, value, line: lineNumber });
  }

  return { directives, bodyStart: closing + 1 };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Tokeniza um texto completo de cifra.
 *
 * Aceita dois formatos de metadados:
 *  - **Frontmatter YAML** (`---` no topo) — formato preferido para autoria.
 *  - **Diretivas ChordPro** (`{title: ...}`) — compatibilidade retroativa.
 *
 * O corpo (após o frontmatter, se houver) usa a sintaxe ChordPro: acordes
 * inline `[G]`, seções `{start_of_verse}` e comentários `# ...`.
 *
 * @param input - Texto completo da cifra.
 * @returns Array de tokens na ordem em que aparecem no texto.
 *
 * @example
 * ```ts
 * const tokens = tokenize('---\ntitle: Ex\n---\n[G]Olá');
 * // [
 * //   { type: 'DIRECTIVE', name: 'title', value: 'Ex', line: 2 },
 * //   { type: 'CHORD', value: 'G', line: 4 },
 * //   { type: 'LYRIC', value: 'Olá', line: 4 },
 * //   { type: 'NEWLINE', line: 4 },
 * // ]
 * ```
 */
export function tokenize(input: string): Token[] {
  const lines = input.split(/\r?\n/);
  const { directives, bodyStart } = parseFrontmatter(lines);
  const tokens: Token[] = [...directives];

  for (let i = bodyStart; i < lines.length; i++) {
    const lineNumber = i + 1;
    const lineTokens = tokenizeLine(lines[i]!, lineNumber);
    tokens.push(...lineTokens);
    tokens.push({ type: 'NEWLINE', line: lineNumber });
  }

  return tokens;
}
