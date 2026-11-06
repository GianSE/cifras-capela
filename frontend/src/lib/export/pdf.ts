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
import { renderSongLyricsOnly, renderSongToLines, type TextLine } from './layout';
import { slugify } from './download';

/** Largura de um caractere em Courier, como fração do tamanho da fonte. */
const COURIER_CHAR_RATIO = 0.6;

const PAGE_MARGIN = 42;
const BASE_FONT_SIZE = 10.5;
const MIN_FONT_SIZE = 6.5;

// Mesma paleta mariana da tela, ajustada para o papel branco.
const COLOR_LYRIC: [number, number, number] = [26, 28, 34];
const COLOR_CHORD: [number, number, number] = [138, 99, 24]; // ouro velho (gold-700)
const COLOR_LABEL: [number, number, number] = [29, 58, 107]; // azul do manto (navy-700)
const COLOR_MUTED: [number, number, number] = [107, 114, 128];

export interface PdfExportOptions {
  /** Nome do arquivo (sem extensão). Padrão: slug do título. */
  filename?: string;
  /** Observação opcional no cabeçalho (ex.: "Transposto +2"). */
  note?: string;
  /** A música é só a folha: estas páginas entram no lugar da cifra. */
  images?: readonly PdfImage[];
}

/** Uma página da folha, em JPEG. */
export interface PdfImage {
  readonly data: string;
  readonly width: number;
  readonly height: number;
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

/** A folha no lugar da cifra: o título em cima e cada página ocupando a folha toda. */
function drawImagePages(
  doc: jsPDF,
  song: Song,
  images: readonly PdfImage[],
  geom: { pageHeight: number; contentWidth: number },
  note?: string,
): void {
  images.forEach((image, index) => {
    if (index > 0) doc.addPage();
    let y = PAGE_MARGIN;

    if (index === 0) {
      if (note) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_LABEL);
        doc.text(note.toUpperCase(), PAGE_MARGIN, y);
        y += 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(...COLOR_LYRIC);
      doc.text(song.metadata.title || 'Sem título', PAGE_MARGIN, y);
      y += 12;
    }

    const height = geom.pageHeight - y - PAGE_MARGIN - 14;
    const scale = Math.min(geom.contentWidth / image.width, height / image.height);
    doc.addImage(image.data, 'JPEG', PAGE_MARGIN, y, image.width * scale, image.height * scale);
  });
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

  if (options.images?.length) {
    drawImagePages(doc, song, options.images, { pageHeight, contentWidth }, options.note);
  } else {
    drawSong(doc, song, { pageWidth, pageHeight, contentWidth }, options.note);
  }
  drawPageNumbers(doc, pageWidth, pageHeight);

  const title = song.metadata.title;
  const name = options.filename ?? (slugify(title || 'musica') || 'musica');
  doc.save(`${name}.pdf`);
}

/** Letra em fonte de leitura, maior que a da cifra: é para cantar a distância. */
const LYRICS_FONT_SIZE = 13;
const LYRICS_LINE_HEIGHT = 17;
/** Título + algumas linhas: menos que isso no fim da folha, a música vai para a próxima. */
const LYRICS_MIN_START = 110;

/**
 * Gera e baixa um PDF **só com a letra**, para quem canta e não toca.
 *
 * Numa playlist, as músicas vêm em sequência, sem índice nem uma folha para cada:
 * quem canta segue a celebração de cima para baixo, e o folheto gasta menos papel.
 *
 * @param entries - Músicas na ordem. A `note` é a parte da missa (ex.: "Entrada").
 * @param heading - Título no topo (o nome da playlist); uma música sozinha não precisa.
 */
export async function exportLyricsToPdf(
  entries: readonly PlaylistPdfEntry[],
  heading?: string,
  options: PdfExportOptions = {},
): Promise<void> {
  if (entries.length === 0) return;

  const { doc, pageWidth, pageHeight, contentWidth } = await createDoc();
  const bottomLimit = pageHeight - PAGE_MARGIN - 14;
  let y = PAGE_MARGIN;

  const ensureSpace = (height: number) => {
    if (y + height > bottomLimit) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };

  if (heading) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...COLOR_LYRIC);
    doc.text(heading, PAGE_MARGIN, y);
    y += 26;
  }

  entries.forEach(({ song, note, images }, index) => {
    // A folha não tem letra para extrair: vai a imagem, em folha própria.
    if (images?.length) {
      if (y > PAGE_MARGIN) doc.addPage();
      drawImagePages(doc, song, images, { pageHeight, contentWidth }, note);
      if (index < entries.length - 1) doc.addPage();
      y = PAGE_MARGIN;
      return;
    }

    if (index > 0 && y > PAGE_MARGIN) y += LYRICS_LINE_HEIGHT;
    ensureSpace(LYRICS_MIN_START);

    if (note) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_LABEL);
      doc.text(note.toUpperCase(), PAGE_MARGIN, y);
      y += 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...COLOR_LYRIC);
    for (const part of doc.splitTextToSize(song.metadata.title || 'Sem título', contentWidth)) {
      doc.text(part as string, PAGE_MARGIN, y);
      y += 18;
    }
    y += 4;

    for (const line of renderSongLyricsOnly(song)) {
      if (line.kind === 'blank') {
        y += LYRICS_LINE_HEIGHT * 0.6;
        continue;
      }

      if (line.kind === 'label') {
        // Junto da primeira linha que ele nomeia, nunca sozinho no fim da folha.
        ensureSpace(LYRICS_LINE_HEIGHT * 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_MUTED);
        doc.text(line.text.toUpperCase(), PAGE_MARGIN, y);
        y += 14;
        continue;
      }

      const isComment = line.kind === 'comment';
      doc.setFont('helvetica', isComment ? 'italic' : 'normal');
      doc.setFontSize(isComment ? LYRICS_FONT_SIZE - 2 : LYRICS_FONT_SIZE);
      doc.setTextColor(...(isComment ? COLOR_MUTED : COLOR_LYRIC));
      for (const part of doc.splitTextToSize(line.text, contentWidth)) {
        ensureSpace(LYRICS_LINE_HEIGHT);
        doc.text(part as string, PAGE_MARGIN, y);
        y += LYRICS_LINE_HEIGHT;
      }
    }
  });

  drawPageNumbers(doc, pageWidth, pageHeight);

  const base = heading ?? entries[0]!.song.metadata.title ?? 'musica';
  doc.save(`${options.filename ?? `${slugify(base) || 'musica'}-letra`}.pdf`);
}

/** Uma música da playlist, com observação própria (ex.: o tom original). */
export interface PlaylistPdfEntry {
  readonly song: Song;
  /** Observação no cabeçalho desta música (ex.: `"orig. G"`). */
  readonly note?: string;
  /** A música é só a folha: estas páginas entram no lugar da cifra. */
  readonly images?: readonly PdfImage[];
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
  doc.text(
    `${songs.length} ${songs.length === 1 ? 'música' : 'músicas'}  ·  ${date}`,
    PAGE_MARGIN,
    y,
  );
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
    if (entry.images?.length) {
      drawImagePages(doc, entry.song, entry.images, geom, entry.note ?? options.note);
    } else {
      drawSong(doc, entry.song, geom, entry.note ?? options.note);
    }
  }

  drawPageNumbers(doc, pageWidth, pageHeight);

  const name = options.filename ?? (slugify(playlistName || 'playlist') || 'playlist');
  doc.save(`${name}.pdf`);
}
