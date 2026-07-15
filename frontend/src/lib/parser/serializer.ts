/**
 * @module serializer
 * @description Serializador que converte uma AST Song de volta para texto
 * no formato ChordPro. É a operação inversa do parser.
 *
 * Útil para: salvar músicas editadas, exportar cifras,
 * garantir round-trip (parse → serialize → parse).
 */

import type {
  Chord,
  Line,
  Section,
  SectionType,
  Segment,
  Song,
  SongMetadata,
} from '@/types/song';

// ---------------------------------------------------------------------------
// Mapeamento de tipos de seção → diretivas ChordPro
// ---------------------------------------------------------------------------

/** Mapeia tipo de seção para o nome da diretiva de abertura */
const SECTION_START_DIRECTIVES: Readonly<Record<Exclude<SectionType, 'none'>, string>> = {
  verse: 'start_of_verse',
  chorus: 'start_of_chorus',
  bridge: 'start_of_bridge',
  tab: 'start_of_tab',
  grid: 'start_of_grid',
};

/** Mapeia tipo de seção para o nome da diretiva de fechamento */
const SECTION_END_DIRECTIVES: Readonly<Record<Exclude<SectionType, 'none'>, string>> = {
  verse: 'end_of_verse',
  chorus: 'end_of_chorus',
  bridge: 'end_of_bridge',
  tab: 'end_of_tab',
  grid: 'end_of_grid',
};

// ---------------------------------------------------------------------------
// Serialização de acordes
// ---------------------------------------------------------------------------

/**
 * Serializa um acorde de volta para sua representação textual entre colchetes.
 *
 * @param chord - Estrutura do acorde
 * @returns Texto do acorde entre colchetes, ex: `[Am7/G]`
 */
function serializeChord(chord: Chord): string {
  return `[${chord.raw}]`;
}

// ---------------------------------------------------------------------------
// Serialização de segmentos e linhas
// ---------------------------------------------------------------------------

/**
 * Serializa um segmento (acorde + letra) para texto ChordPro.
 *
 * @param segment - Segmento a ser serializado
 * @returns Texto do segmento
 */
function serializeSegment(segment: Segment): string {
  if (segment.chord) {
    return `${serializeChord(segment.chord)}${segment.lyric}`;
  }
  return segment.lyric;
}

/**
 * Serializa uma linha para texto ChordPro.
 *
 * @param line - Linha a ser serializada
 * @returns Texto da linha (sem quebra de linha no final)
 */
function serializeLine(line: Line): string {
  switch (line.type) {
    case 'empty':
      return '';
    case 'comment':
      return `# ${line.comment ?? ''}`;
    case 'lyrics':
    case 'chords-only':
      return line.segments.map(serializeSegment).join('');
  }
}

// ---------------------------------------------------------------------------
// Serialização de seções
// ---------------------------------------------------------------------------

/**
 * Serializa uma seção inteira para texto ChordPro.
 *
 * @param section - Seção a ser serializada
 * @returns Array de linhas de texto
 */
function serializeSection(section: Section): string[] {
  const output: string[] = [];

  // Diretiva de abertura (se não for 'none')
  if (section.type !== 'none') {
    const startDirective = SECTION_START_DIRECTIVES[section.type];
    if (section.label) {
      output.push(`{${startDirective}: ${section.label}}`);
    } else {
      output.push(`{${startDirective}}`);
    }
  }

  // Linhas da seção
  for (const line of section.lines) {
    output.push(serializeLine(line));
  }

  // Diretiva de fechamento (se não for 'none')
  if (section.type !== 'none') {
    const endDirective = SECTION_END_DIRECTIVES[section.type];
    output.push(`{${endDirective}}`);
  }

  return output;
}

// ---------------------------------------------------------------------------
// Serialização de metadados
// ---------------------------------------------------------------------------

/**
 * Serializa os metadados da música para diretivas ChordPro.
 *
 * @param metadata - Metadados da música
 * @returns Array de linhas de diretivas
 */
function serializeMetadata(metadata: SongMetadata): string[] {
  const output: string[] = [];

  // Diretivas obrigatórias/principais
  if (metadata.title) {
    output.push(`{title: ${metadata.title}}`);
  }
  if (metadata.artist) {
    output.push(`{artist: ${metadata.artist}}`);
  }
  if (metadata.key) {
    output.push(`{key: ${metadata.key}}`);
  }
  if (metadata.tempo !== undefined) {
    output.push(`{tempo: ${metadata.tempo}}`);
  }
  if (metadata.time) {
    output.push(`{time: ${metadata.time}}`);
  }
  if (metadata.capo !== undefined) {
    output.push(`{capo: ${metadata.capo}}`);
  }
  if (metadata.album) {
    output.push(`{album: ${metadata.album}}`);
  }
  if (metadata.year) {
    output.push(`{year: ${metadata.year}}`);
  }
  if (metadata.copyright) {
    output.push(`{copyright: ${metadata.copyright}}`);
  }
  if (metadata.categories && metadata.categories.length > 0) {
    output.push(`{categories: ${metadata.categories.join(', ')}}`);
  } else if (metadata.category) {
    output.push(`{category: ${metadata.category}}`);
  }
  if (metadata.language) {
    output.push(`{language: ${metadata.language}}`);
  }

  // Tags
  if (metadata.tags && metadata.tags.length > 0) {
    output.push(`{tags: ${metadata.tags.join(', ')}}`);
  }

  // Diretivas customizadas
  for (const [key, value] of Object.entries(metadata.custom)) {
    output.push(`{${key}: ${value}}`);
  }

  return output;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Serializa uma AST Song de volta para texto no formato ChordPro.
 *
 * Produz texto válido que pode ser re-parseado pelo parser, mantendo
 * a estrutura original da música (metadados, seções, linhas, acordes).
 *
 * @param song - AST da música a ser serializada
 * @returns Texto completo no formato ChordPro
 *
 * @example
 * ```ts
 * const text = serialize(song);
 * // {title: Porque Ele Vive}
 * // {artist: Harpa Cristã}
 * //
 * // {start_of_verse: Verso 1}
 * // [G]Deus enviou [C]Seu Filho [G]amado
 * // {end_of_verse}
 * ```
 */
export function serialize(song: Song): string {
  const output: string[] = [];

  // Metadados
  const metadataLines = serializeMetadata(song.metadata);
  output.push(...metadataLines);

  // Separador entre metadados e conteúdo
  if (metadataLines.length > 0 && song.sections.length > 0) {
    output.push('');
  }

  // Seções
  for (let i = 0; i < song.sections.length; i++) {
    const section = song.sections[i]!;
    const sectionLines = serializeSection(section);
    output.push(...sectionLines);

    // Linha em branco entre seções (exceto a última)
    if (i < song.sections.length - 1) {
      output.push('');
    }
  }

  return output.join('\n');
}

// ---------------------------------------------------------------------------
// Serialização para o formato de autoria (frontmatter + seções amigáveis)
// ---------------------------------------------------------------------------

/** Palavra padrão da seção quando não há rótulo explícito. */
const SECTION_WORD: Readonly<Record<Exclude<SectionType, 'none'>, string>> = {
  verse: 'Verso',
  chorus: 'Refrão',
  bridge: 'Ponte',
  tab: 'Tab',
  grid: 'Grid',
};

/**
 * Serializa uma AST Song no **formato de autoria preferido**: frontmatter YAML
 * para os metadados + corpo com seções amigáveis (`{Verso 1}`) e acordes inline.
 *
 * É o formato salvo pelo editor e usado na exportação. Faz round-trip com o
 * parser (parse → serializeToFrontmatter → parse preserva os dados).
 *
 * @param song - AST da música.
 * @returns Texto completo no formato híbrido (frontmatter + ChordPro).
 */
export function serializeToFrontmatter(song: Song): string {
  const m = song.metadata;
  const fm: string[] = ['---', `title: ${m.title}`];

  if (m.artist) fm.push(`artist: ${m.artist}`);
  if (m.key) fm.push(`key: ${m.key}`);
  if (m.tempo !== undefined) fm.push(`tempo: ${m.tempo}`);
  if (m.time) fm.push(`time: ${m.time}`);
  if (m.capo !== undefined) fm.push(`capo: ${m.capo}`);
  if (m.categories && m.categories.length > 0) {
    fm.push(`categories: [${m.categories.join(', ')}]`);
  } else if (m.category) {
    fm.push(`categories: [${m.category}]`);
  }
  if (m.tags && m.tags.length > 0) fm.push(`tags: [${m.tags.join(', ')}]`);
  if (m.language) fm.push(`language: ${m.language}`);
  if (m.album) fm.push(`album: ${m.album}`);
  if (m.year) fm.push(`year: ${m.year}`);
  if (m.copyright) fm.push(`copyright: ${m.copyright}`);
  fm.push('---', '');

  const body: string[] = [];
  song.sections.forEach((section, i) => {
    if (section.type !== 'none') {
      body.push(`{${section.label ?? SECTION_WORD[section.type]}}`);
    }
    for (const line of section.lines) {
      body.push(serializeLine(line));
    }
    if (i < song.sections.length - 1) body.push('');
  });

  return [...fm, ...body].join('\n');
}
