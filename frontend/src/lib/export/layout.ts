/**
 * @module lib/export/layout
 * @description Converte a AST de uma música no layout clássico de cifra:
 * acordes posicionados **acima** da letra, alinhados por coluna.
 *
 * O resultado é uma lista de linhas tipadas, pensada para renderização
 * monoespaçada (PDF, TXT, impressão). Manter isso separado do jsPDF deixa o
 * algoritmo puro e testável.
 *
 * @example
 * // "[G]Porque Ele [C]vive" produz:
 * // { kind: 'chord', text: 'G          C'     }
 * // { kind: 'lyric', text: 'Porque Ele vive'  }
 */

import type { Line, Section, Song } from '@/types/song';

/** Tipo de linha do layout renderizado. */
export type TextLineKind = 'label' | 'chord' | 'lyric' | 'comment' | 'blank';

export interface TextLine {
  readonly kind: TextLineKind;
  readonly text: string;
}

/** Remove apenas os espaços à direita (preserva a indentação/alinhamento). */
function trimEnd(text: string): string {
  return text.replace(/\s+$/, '');
}

/**
 * Monta o par (linha de acordes, linha de letra) de uma linha da cifra.
 *
 * Cada acorde é posicionado na coluna onde começa a sílaba correspondente.
 * Se um acorde for mais largo que sua sílaba, a letra recebe espaços extras
 * para que o próximo acorde não colida (mantendo pelo menos 1 espaço entre eles).
 */
export function buildChordLyricPair(line: Line): { chords: string; lyrics: string } {
  let chords = '';
  let lyrics = '';

  for (const segment of line.segments) {
    const chord = segment.chord?.raw ?? '';

    if (chord) {
      // Acorde anterior invadiu o espaço da letra? Empurra a letra para frente.
      if (chords.length > lyrics.length) {
        lyrics = lyrics.padEnd(chords.length + 1, ' ');
      }
      chords = chords.padEnd(lyrics.length, ' ') + chord;
    }

    lyrics += segment.lyric;
  }

  return { chords: trimEnd(chords), lyrics: trimEnd(lyrics) };
}

function renderLine(line: Line, out: TextLine[]): void {
  if (line.type === 'empty') {
    out.push({ kind: 'blank', text: '' });
    return;
  }

  if (line.type === 'comment') {
    out.push({ kind: 'comment', text: line.comment ?? '' });
    return;
  }

  const { chords, lyrics } = buildChordLyricPair(line);
  if (chords) out.push({ kind: 'chord', text: chords });
  if (lyrics) out.push({ kind: 'lyric', text: lyrics });
  // Linha só de acordes, sem letra: já coberta acima.
}

function renderSection(section: Section, out: TextLine[]): void {
  if (section.type !== 'none' && section.label) {
    out.push({ kind: 'label', text: section.label });
  }

  // Pula linhas vazias no início da seção: o token NEWLINE que segue a
  // diretiva (`{verso 1}`) gera uma linha vazia que não deve virar espaço.
  let started = false;
  for (const line of section.lines) {
    if (!started && line.type === 'empty') continue;
    started = true;
    renderLine(line, out);
  }
}

/**
 * Renderiza a música inteira como linhas tipadas (acordes acima da letra).
 */
export function renderSongToLines(song: Song): TextLine[] {
  const out: TextLine[] = [];

  song.sections.forEach((section, index) => {
    if (index > 0) out.push({ kind: 'blank', text: '' });
    renderSection(section, out);
  });

  // Remove linhas em branco duplicadas/no fim.
  const cleaned: TextLine[] = [];
  for (const line of out) {
    const prev = cleaned[cleaned.length - 1];
    if (line.kind === 'blank' && (!prev || prev.kind === 'blank')) continue;
    cleaned.push(line);
  }
  while (cleaned[cleaned.length - 1]?.kind === 'blank') cleaned.pop();

  return cleaned;
}

/**
 * Renderiza a música como texto puro (acordes acima da letra) — export .txt
 * e base para o PDF.
 */
export function songToPlainText(song: Song): string {
  const { title, artist, key, tempo, capo } = song.metadata;

  const header: string[] = [title];
  if (artist) header.push(artist);

  const meta = [
    key ? `Tom: ${key}` : '',
    tempo !== undefined ? `${tempo} BPM` : '',
    capo ? `Capo: ${capo}` : '',
  ].filter(Boolean);
  if (meta.length > 0) header.push(meta.join(' · '));

  const body = renderSongToLines(song)
    .map((l) => (l.kind === 'label' ? `[${l.text}]` : l.text))
    .join('\n');

  return `${header.join('\n')}\n\n${body}\n`;
}
