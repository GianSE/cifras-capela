/**
 * @module lib/editor/cho-document
 * @description O `.cho` visto linha a linha, para editar sem digitar colchetes.
 *
 * O arquivo continua sendo a fonte da verdade: aqui ele só é desmontado em letra
 * + acordes por posição, e remontado depois. A regra que protege as músicas é que
 * **abrir e não mexer devolve o arquivo idêntico**: por isso o que não é letra
 * (frontmatter, diretivas, comentários) fica guardado como veio.
 *
 * Funções puras: nada muda no lugar, e cada operação devolve a linha nova.
 */

export interface ChordMark {
  /** Posição na letra: o acorde cai antes deste caractere. */
  readonly at: number;
  readonly chord: string;
}

export interface LyricLine {
  readonly id: number;
  readonly kind: 'lyric';
  readonly text: string;
  readonly chords: readonly ChordMark[];
}

/** Diretiva de seção (`{refrão}`), guardada como veio. */
export interface SectionLine {
  readonly id: number;
  readonly kind: 'section';
  readonly text: string;
}

/** Outra linha que não é letra (comentário, metadado), guardada como veio. */
export interface RawLine {
  readonly id: number;
  readonly kind: 'raw';
  readonly text: string;
}

export type DocLine = LyricLine | SectionLine | RawLine;

export interface ChoDocument {
  /** O bloco `---`, com a quebra de linha depois dele. Vazio se não houver. */
  readonly frontmatter: string;
  readonly lines: readonly DocLine[];
  readonly eol: '\n' | '\r\n';
}

let nextId = 1;
const newId = () => nextId++;

const FRONTMATTER_RE = /^---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/;
const CHORD_RE = /\[([^[\]]*)\]/g;
/** `{refrão}`, `{verso 1}`. Com dois-pontos é metadado; `soc`/`eoc` só marcam limites. */
const SECTION_RE = /^\s*\{\s*([^{}:]+?)\s*\}\s*$/;
const ENVIRONMENT_RE = /^(so|eo)[a-z]$|^(start|end)_of_/i;

/** Lê uma linha de letra: `[G]Por[C]que` → texto `Porque`, acordes em 0 e 3. */
export function parseLyricLine(raw: string): Pick<LyricLine, 'text' | 'chords'> {
  const chords: ChordMark[] = [];
  let text = '';
  let last = 0;
  for (const match of raw.matchAll(CHORD_RE)) {
    text += raw.slice(last, match.index);
    chords.push({ at: text.length, chord: match[1]! });
    last = match.index + match[0].length;
  }
  return { text: text + raw.slice(last), chords };
}

export function lyricLine(raw = ''): LyricLine {
  return { id: newId(), kind: 'lyric', ...parseLyricLine(raw) };
}

export function sectionLine(name: string): SectionLine {
  return { id: newId(), kind: 'section', text: `{${name}}` };
}

function parseLine(raw: string): DocLine {
  const trimmed = raw.trim();
  const section = SECTION_RE.exec(raw);
  if (section) {
    return ENVIRONMENT_RE.test(section[1]!)
      ? { id: newId(), kind: 'raw', text: raw }
      : { id: newId(), kind: 'section', text: raw };
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('#')) {
    return { id: newId(), kind: 'raw', text: raw };
  }
  return lyricLine(raw);
}

export function parseDocument(source: string): ChoDocument {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const frontmatter = FRONTMATTER_RE.exec(source)?.[0] ?? '';
  const body = source.slice(frontmatter.length);
  return { frontmatter, eol, lines: body.split(/\r?\n/).map(parseLine) };
}

/** Volta ao formato com colchetes. */
export function lineToText(line: DocLine): string {
  if (line.kind !== 'lyric') return line.text;
  let out = '';
  let last = 0;
  for (const { at, chord } of line.chords) {
    out += `${line.text.slice(last, at)}[${chord}]`;
    last = at;
  }
  return out + line.text.slice(last);
}

export function serializeDocument(doc: ChoDocument): string {
  return doc.frontmatter + doc.lines.map(lineToText).join(doc.eol);
}

/** O nome dentro de `{...}`. */
export function sectionName(line: SectionLine): string {
  return SECTION_RE.exec(line.text)?.[1] ?? line.text;
}

const byPosition = (chords: readonly ChordMark[]): ChordMark[] =>
  chords
    .map((mark, index) => ({ mark, index }))
    .sort((a, b) => a.mark.at - b.mark.at || a.index - b.index)
    .map(({ mark }) => mark);

/* ==========================================================================
   Editar a letra: os acordes acompanham a sílaba
   ========================================================================== */

/**
 * Para onde vai cada acorde quando o texto muda. Compara o que sobrou igual no
 * começo e no fim: o que vem depois do trecho alterado anda junto com ele, e o
 * que estava **dentro** dele fica na posição proporcional, sem sumir.
 *
 * `caret` (o cursor depois da edição) desfaz a ambiguidade com letras repetidas:
 * sem ele, digitar um "a" no meio de "aa" pareceria ter sido no fim.
 */
function remapChords(
  chords: readonly ChordMark[],
  before: string,
  after: string,
  caret?: number,
): ChordMark[] {
  const limit = Math.min(before.length, after.length);

  let suffix = 0;
  if (caret !== undefined && caret >= 0 && caret <= after.length) {
    const tail = after.slice(caret);
    if (before.endsWith(tail)) suffix = tail.length;
  }
  if (suffix === 0) {
    while (
      suffix < limit &&
      before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
    ) {
      suffix++;
    }
  }

  let prefix = 0;
  const maxPrefix = limit - suffix;
  while (prefix < maxPrefix && before[prefix] === after[prefix]) prefix++;

  const oldEnd = before.length - suffix;
  const newEnd = after.length - suffix;
  const oldSize = oldEnd - prefix;
  const newSize = newEnd - prefix;

  return chords.map(({ at, chord }) => {
    let next: number;
    if (at <= prefix && !(oldSize === 0 && at === prefix)) next = at;
    else if (at >= oldEnd) next = at + (newEnd - oldEnd);
    else next = prefix + Math.round(((at - prefix) / oldSize) * newSize);
    return { at: Math.min(Math.max(next, 0), after.length), chord };
  });
}

/**
 * A letra foi editada. Quem digita ou cola `[G]` no campo também acerta: o
 * colchete vira acorde em vez de ficar no meio da letra.
 */
export function editLyric(line: LyricLine, raw: string, caret?: number): LyricLine {
  const parsed = parseLyricLine(raw);
  const hadBrackets = parsed.chords.length > 0;
  const moved = remapChords(line.chords, line.text, parsed.text, hadBrackets ? undefined : caret);
  return { ...line, text: parsed.text, chords: byPosition([...moved, ...parsed.chords]) };
}

/** Enter no meio da linha: cada acorde vai com o seu pedaço de letra. */
export function splitLine(line: LyricLine, at: number): [LyricLine, LyricLine] {
  const head = line.text.slice(0, at).replace(/\s+$/, '');
  const rawTail = line.text.slice(at);
  const tail = rawTail.replace(/^\s+/, '');
  const dropped = rawTail.length - tail.length;

  return [
    {
      ...line,
      text: head,
      chords: line.chords
        .filter((c) => c.at < at)
        .map((c) => ({ ...c, at: Math.min(c.at, head.length) })),
    },
    {
      id: newId(),
      kind: 'lyric',
      text: tail,
      chords: line.chords
        .filter((c) => c.at >= at)
        .map((c) => ({ ...c, at: Math.max(c.at - at - dropped, 0) })),
    },
  ];
}

/** Junta com a linha de baixo, com um espaço entre as duas se precisar. */
export function mergeLines(first: LyricLine, second: LyricLine): LyricLine {
  const glue = first.text === '' || second.text === '' || /\s$/.test(first.text) ? '' : ' ';
  const offset = first.text.length + glue.length;
  return {
    ...first,
    text: first.text + glue + second.text,
    chords: [...first.chords, ...second.chords.map((c) => ({ ...c, at: c.at + offset }))],
  };
}

/* ==========================================================================
   Editar os acordes: a letra não muda
   ========================================================================== */

/** Linha só de acordes (`[G] [D] [Em]`): não há sílaba para ancorar. */
export function isChordOnly(line: LyricLine): boolean {
  return line.chords.length > 0 && line.text.trim() === '';
}

/** Numa linha só de acordes, a posição é só a ordem: fica um espaço entre eles. */
function chordOnlyLine(line: LyricLine, chords: readonly string[]): LyricLine {
  return {
    ...line,
    text: ' '.repeat(Math.max(chords.length - 1, 0)),
    chords: chords.map((chord, at) => ({ at, chord })),
  };
}

export function addChord(line: LyricLine, at: number, chord: string): LyricLine {
  if (isChordOnly(line)) {
    return chordOnlyLine(line, [...line.chords.map((c) => c.chord), chord]);
  }
  const position = Math.min(Math.max(at, 0), line.text.length);
  return { ...line, chords: byPosition([...line.chords, { at: position, chord }]) };
}

export function setChord(line: LyricLine, index: number, chord: string): LyricLine {
  return { ...line, chords: line.chords.map((c, i) => (i === index ? { ...c, chord } : c)) };
}

export function removeChord(line: LyricLine, index: number): LyricLine {
  if (isChordOnly(line)) {
    return chordOnlyLine(
      line,
      line.chords.filter((_, i) => i !== index).map((c) => c.chord),
    );
  }
  return { ...line, chords: line.chords.filter((_, i) => i !== index) };
}

/**
 * Leva o acorde para outra posição e devolve também o índice novo dele, que pode
 * mudar se ele passar por outro acorde.
 */
export function moveChord(
  line: LyricLine,
  index: number,
  at: number,
): { line: LyricLine; index: number } {
  const moving = line.chords[index];
  if (!moving) return { line, index };

  const position = Math.min(Math.max(at, 0), line.text.length);
  const mark = { ...moving, at: position };
  const chords = byPosition([...line.chords.filter((_, i) => i !== index), mark]);
  return { line: { ...line, chords }, index: chords.indexOf(mark) };
}

/** Um passo para o lado. Numa linha só de acordes, troca de lugar com o vizinho. */
export function nudgeChord(
  line: LyricLine,
  index: number,
  step: -1 | 1,
): { line: LyricLine; index: number } {
  if (isChordOnly(line)) {
    const target = index + step;
    if (target < 0 || target >= line.chords.length) return { line, index };
    const names = line.chords.map((c) => c.chord);
    [names[index], names[target]] = [names[target]!, names[index]!];
    return { line: chordOnlyLine(line, names), index: target };
  }
  const mark = line.chords[index];
  return mark ? moveChord(line, index, mark.at + step) : { line, index };
}

/**
 * A letra em pedaços, cada um com o acorde que cai no começo dele: é o que a tela
 * desenha, com o acorde em cima. Dois acordes na mesma posição viram pedaços vazios.
 */
export function lineSegments(
  line: LyricLine,
): { chordIndex: number | null; start: number; text: string }[] {
  const segments: { chordIndex: number | null; start: number; text: string }[] = [];
  const first = line.chords[0]?.at ?? line.text.length;
  if (first > 0 || line.chords.length === 0) {
    segments.push({ chordIndex: null, start: 0, text: line.text.slice(0, first) });
  }
  line.chords.forEach((mark, index) => {
    const end = line.chords[index + 1]?.at ?? line.text.length;
    segments.push({ chordIndex: index, start: mark.at, text: line.text.slice(mark.at, end) });
  });
  return segments;
}

/** A linha de acordes alinhada à letra, em fonte de largura fixa, só para ver. */
export function chordRow(line: LyricLine): string {
  let row = '';
  for (const { at, chord } of line.chords) {
    // Acorde largo empurra o seguinte: a letra não muda, então a coluna cede.
    const column = row.length === 0 ? at : Math.max(at, row.length + 1);
    row = row.padEnd(column, ' ') + chord;
  }
  return row;
}

/** Os acordes do arquivo, os mais usados primeiro: as sugestões ao escolher um. */
export function usedChords(doc: ChoDocument): string[] {
  const count = new Map<string, number>();
  for (const line of doc.lines) {
    if (line.kind !== 'lyric') continue;
    for (const { chord } of line.chords) {
      if (chord.trim()) count.set(chord, (count.get(chord) ?? 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([chord]) => chord);
}

/* ==========================================================================
   Frontmatter: só a linha do campo alterado muda
   ========================================================================== */

const fieldRe = (name: string) => new RegExp(`^${name}:[ \\t]*(.*?)[ \\t]*\\r?$`, 'm');

/** O valor como está escrito no arquivo. `categories` vem sem os colchetes. */
export function getField(source: string, name: string): string {
  const block = FRONTMATTER_RE.exec(source)?.[0] ?? '';
  const value = fieldRe(name).exec(block)?.[1] ?? '';
  return value.replace(/^\[(.*)\]$/, '$1');
}

/** Troca o valor de um campo, criando o campo, ou o bloco inteiro, se faltar. */
export function setField(source: string, name: string, rawValue: string): string {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const clean = rawValue.replace(/\r?\n/g, ' ');
  const value = name === 'categories' ? `[${clean}]` : clean;
  const line = `${name}: ${value}`.replace(/\s+$/, '');

  const block = FRONTMATTER_RE.exec(source)?.[0];
  if (block === undefined) return `---${eol}${line}${eol}---${eol}${eol}${source}`;

  const re = fieldRe(name);
  // Com função, para um `$` no título não ser lido como referência.
  const updated = re.test(block)
    ? block.replace(re, () => (block.includes('\r\n') ? `${line}\r` : line))
    : block.replace(/(\r?\n)---[ \t]*(\r?\n|$)/, (_, before, after) => {
        return `${before}${line}${before}---${after}`;
      });
  return updated + source.slice(block.length);
}
