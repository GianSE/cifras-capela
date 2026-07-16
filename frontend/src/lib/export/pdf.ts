/**
 * @module lib/export/pdf
 * @description Exporta música(s) como PDF, mantendo os acordes alinhados
 * acima da letra.
 *
 * Usa fonte monoespaçada (Courier) para que o alinhamento por coluna calculado
 * em `layout.ts` seja preservado no papel. O jsPDF é carregado sob demanda
 * (import dinâmico), então não entra no bundle inicial.
 */

import type { jsPDF } from 'jspdf';
import type { Song } from '@/types/song';
import { renderSongToLines, type TextLine } from './layout';
import { slugify } from './download';

/** Largura de um caractere em Courier, como fração do tamanho da fonte. */
const COURIER_CHAR_RATIO = 0.6;

const PAGE_MARGIN = 42;
const BASE_FONT_SIZE = 10.5;
const MIN_FONT_SIZE = 6.5;

const COLOR_LYRIC: [number, number, number] = [23, 26, 30];
const COLOR_CHORD: [number, number, number] = [168, 100, 0]; // âmbar legível no papel
const COLOR_LABEL: [number, number, number] = [62, 92, 255]; // indigo
const COLOR_MUTED: [number, number, number] = [110, 118, 132];

export interface PdfExportOptions {
  /** Nome do arquivo (sem extensão). Padrão: slug do título. */
  filename?: string;
  /** Observação opcional no cabeçalho (ex.: "Transposto +2"). */
  note?: string;
}

/**
 * Quebra um par acorde/letra em várias linhas respeitando `maxChars`,
 * preservando o alinhamento entre as duas linhas.
 */
function wrapPair(chords: string, lyrics: string, maxChars: number): Array<[string, string]> {
  if (chords.length <= maxChars && lyrics.length <= maxChars) {
    return [[chords, lyrics]];
  }

  const out: Array<[string, string]> = [];
  let c = chords;
  let l = lyrics;

  while (c.length > maxChars || l.length > maxChars) {
    // Quebra preferencialmente num espaço da letra, perto do limite.
    let cut = l.lastIndexOf(' ', maxChars);
    if (cut <= 0) cut = maxChars;

    out.push([c.slice(0, cut).replace(/\s+$/, ''), l.slice(0, cut).replace(/\s+$/, '')]);
    c = c.slice(cut).replace(/^\s/, '');
    l = l.slice(cut).replace(/^\s/, '');
  }

  if (c.trim() || l.trim()) out.push([c, l]);
  return out;
}

interface Block {
  kind: TextLine['kind'];
  chords?: string;
  lyric?: string;
}

/** Reagrupa as linhas do layout em unidades que não devem ser separadas. */
function toBlocks(lines: readonly TextLine[]): Block[] {
  const blocks: Block[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.kind === 'chord' && lines[i + 1]?.kind === 'lyric') {
      blocks.push({ kind: 'lyric', chords: line.text, lyric: lines[i + 1]!.text });
      i++;
    } else if (line.kind === 'chord') {
      blocks.push({ kind: 'chord', chords: line.text });
    } else {
      blocks.push({ kind: line.kind, lyric: line.text });
    }
  }

  return blocks;
}

/** Cria o documento A4 e as medidas derivadas. */
async function createDoc() {
  const { jsPDF: JsPdf } = await import('jspdf');
  const doc = new JsPdf({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  return { doc, pageWidth, pageHeight, contentWidth: pageWidth - PAGE_MARGIN * 2 };
}

/**
 * Desenha uma música inteira no documento, a partir do topo da página atual.
 * Cuida da quebra de página e nunca separa um acorde da sua letra.
 */
function drawSong(
  doc: jsPDF,
  song: Song,
  geom: { pageWidth: number; pageHeight: number; contentWidth: number },
  note?: string,
): void {
  const { pageWidth, pageHeight, contentWidth } = geom;
  const lines = renderSongToLines(song);

  // Ajusta a fonte para que a linha mais longa caiba na página.
  const longest = lines.reduce((max, l) => Math.max(max, l.text.length), 0);
  const fitted = longest > 0 ? contentWidth / (COURIER_CHAR_RATIO * longest) : BASE_FONT_SIZE;
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(BASE_FONT_SIZE, fitted));
  const maxChars = Math.floor(contentWidth / (COURIER_CHAR_RATIO * fontSize));
  const lineHeight = fontSize * 1.25;

  const { title, artist, key, tempo, capo } = song.metadata;
  let y = PAGE_MARGIN;

  // ── Cabeçalho da música ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_LYRIC);
  doc.text(title || 'Sem título', PAGE_MARGIN, y);
  y += 20;

  if (artist) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(artist, PAGE_MARGIN, y);
    y += 15;
  }

  const meta = [
    key ? `Tom: ${key}` : '',
    tempo !== undefined ? `${tempo} BPM` : '',
    capo ? `Capo: ${capo}` : '',
    note ?? '',
  ].filter(Boolean);

  if (meta.length > 0) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_CHORD);
    doc.text(meta.join('  ·  '), PAGE_MARGIN, y);
    y += 12;
  }

  doc.setDrawColor(220, 224, 230);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  y += lineHeight * 1.4;

  const bottomLimit = pageHeight - PAGE_MARGIN - 14;
  const ensureSpace = (height: number) => {
    if (y + height > bottomLimit) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };

  // ── Corpo ────────────────────────────────────────────────────────────────
  for (const block of toBlocks(lines)) {
    if (block.kind === 'blank') {
      y += lineHeight * 0.6;
      continue;
    }

    if (block.kind === 'label') {
      ensureSpace(lineHeight * 2);
      y += lineHeight * 0.3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize * 0.95);
      doc.setTextColor(...COLOR_LABEL);
      doc.text((block.lyric ?? '').toUpperCase(), PAGE_MARGIN, y);
      y += lineHeight;
      continue;
    }

    if (block.kind === 'comment') {
      ensureSpace(lineHeight);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(fontSize * 0.9);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(block.lyric ?? '', PAGE_MARGIN, y);
      y += lineHeight;
      continue;
    }

    // Par acorde/letra — nunca separados entre páginas.
    for (const [chords, lyric] of wrapPair(block.chords ?? '', block.lyric ?? '', maxChars)) {
      ensureSpace((chords ? lineHeight : 0) + (lyric ? lineHeight : 0));

      if (chords) {
        doc.setFont('courier', 'bold');
        doc.setFontSize(fontSize);
        doc.setTextColor(...COLOR_CHORD);
        doc.text(chords, PAGE_MARGIN, y);
        y += lineHeight;
      }
      if (lyric) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(...COLOR_LYRIC);
        doc.text(lyric, PAGE_MARGIN, y);
        y += lineHeight;
      }
    }
  }
}

/** Numera todas as páginas no rodapé. */
function drawPageNumbers(doc: jsPDF, pageWidth: number, pageHeight: number): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`${page}/${total}`, pageWidth - PAGE_MARGIN, pageHeight - PAGE_MARGIN + 8, {
      align: 'right',
    });
  }
}

/**
 * Gera e baixa o PDF de **uma** música.
 *
 * @param song - AST da música (já transposta, se for o caso).
 */
export async function exportSongToPdf(song: Song, options: PdfExportOptions = {}): Promise<void> {
  const { doc, pageWidth, pageHeight, contentWidth } = await createDoc();

  drawSong(doc, song, { pageWidth, pageHeight, contentWidth }, options.note);
  drawPageNumbers(doc, pageWidth, pageHeight);

  const title = song.metadata.title;
  const name = options.filename ?? (slugify(title || 'musica') || 'musica');
  doc.save(`${name}.pdf`);
}

/** Uma música da playlist, com observação própria (ex.: o tom original). */
export interface PlaylistPdfEntry {
  readonly song: Song;
  /** Observação no cabeçalho desta música (ex.: `"orig. G"`). */
  readonly note?: string;
}

/**
 * Gera e baixa **um único PDF** com todas as músicas da playlist, na ordem:
 * uma página de índice + cada música começando em página nova (para virar a
 * folha durante a execução).
 *
 * As músicas devem chegar **já transpostas** para o tom de execução — assim o
 * índice e os cabeçalhos mostram o tom que você vai tocar, não o original.
 *
 * @param entries - Músicas na ordem da playlist, com observação opcional.
 * @param playlistName - Nome exibido na capa/índice.
 */
export async function exportPlaylistToPdf(
  entries: readonly PlaylistPdfEntry[],
  playlistName: string,
  options: PdfExportOptions = {},
): Promise<void> {
  if (entries.length === 0) return;
  const songs = entries.map((e) => e.song);

  const { doc, pageWidth, pageHeight, contentWidth } = await createDoc();
  const geom = { pageWidth, pageHeight, contentWidth };

  // ── Índice ───────────────────────────────────────────────────────────────
  let y = PAGE_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_LYRIC);
  doc.text(playlistName, PAGE_MARGIN, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_MUTED);
  const date = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`${songs.length} ${songs.length === 1 ? 'música' : 'músicas'}  ·  ${date}`, PAGE_MARGIN, y);
  y += 16;

  doc.setDrawColor(220, 224, 230);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  y += 22;

  songs.forEach((song, index) => {
    if (y > pageHeight - PAGE_MARGIN - 20) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    const { title, artist, key } = song.metadata;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_LYRIC);
    doc.text(`${index + 1}.`, PAGE_MARGIN, y);
    doc.text(title || 'Sem título', PAGE_MARGIN + 20, y);

    if (artist) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(artist, PAGE_MARGIN + 20, y + 11);
    }

    if (key) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_CHORD);
      doc.text(key, pageWidth - PAGE_MARGIN, y, { align: 'right' });
    }

    y += artist ? 26 : 18;
  });

  // ── Músicas (uma por página) ─────────────────────────────────────────────
  for (const entry of entries) {
    doc.addPage();
    drawSong(doc, entry.song, geom, entry.note ?? options.note);
  }

  drawPageNumbers(doc, pageWidth, pageHeight);

  const name = options.filename ?? (slugify(playlistName || 'playlist') || 'playlist');
  doc.save(`${name}.pdf`);
}
