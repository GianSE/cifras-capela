/**
 * @module lib/export/pdf
 * @description Exporta música(s) como PDF, mantendo os acordes alinhados
 * acima da letra.
 *
 * Usa fonte monoespaçada (Courier) para que o alinhamento por coluna calculado
 * em `layout.ts` seja preservado no papel. O jsPDF é carregado sob demanda
 * (import dinâmico), então não entra no bundle inicial.
 *
 * Numa playlist, as músicas se encaixam: a que cabe inteira no que sobrou da
 * folha vai ali mesmo; a que não cabe começa no alto da folha seguinte, para
 * ninguém virar a página no meio dela. Só a música maior que uma folha inteira
 * continua na próxima.
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

/** Espaço entre duas músicas que dividem a folha. */
const SONG_GAP = 30;

// Mesma paleta mariana da tela, ajustada para o papel branco.
const COLOR_LYRIC: [number, number, number] = [26, 28, 34];
const COLOR_CHORD: [number, number, number] = [138, 99, 24]; // ouro velho (gold-700)
const COLOR_LABEL: [number, number, number] = [29, 58, 107]; // azul do manto (navy-700)
const COLOR_MUTED: [number, number, number] = [107, 114, 128];
const COLOR_RULE: [number, number, number] = [220, 224, 230];

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

/** Uma música da playlist, com observação própria (ex.: o tom original). */
export interface PlaylistPdfEntry {
  readonly song: Song;
  /** Observação no cabeçalho desta música (ex.: `"Entrada · orig. G"`). */
  readonly note?: string;
  /** A parte da missa, para o sumário. */
  readonly part?: string;
  /** A música é só a folha: estas páginas entram no lugar da cifra. */
  readonly images?: readonly PdfImage[];
}

export interface PlaylistPdfOptions {
  /** Nome no topo (capa do sumário, ou título da primeira folha). */
  readonly title?: string;
  /** Só a letra, para quem canta. */
  readonly lyricsOnly?: boolean;
  /** Sumário na primeira folha, com a página de cada música. */
  readonly toc?: boolean;
  /** Nome do arquivo (sem extensão). */
  readonly filename?: string;
}

interface Geom {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly contentWidth: number;
}

const TOP = PAGE_MARGIN;
const bottomOf = (geom: Geom) => geom.pageHeight - PAGE_MARGIN - 14;

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
  return { doc, geom: { pageWidth, pageHeight, contentWidth: pageWidth - PAGE_MARGIN * 2 } };
}

/**
 * O mesmo documento, mas sem desenhar nada: serve para medir uma música antes de
 * colocá-la. O desenho roda o mesmo código, então medida e resultado nunca divergem.
 * Se a música precisaria de outra folha, `overflowed` avisa.
 */
function probe(doc: jsPDF): { doc: jsPDF; overflowed: () => boolean } {
  let overflowed = false;
  const silent = new Set(['text', 'line', 'addImage', 'setPage']);
  const proxy: jsPDF = new Proxy(doc, {
    get(target, prop) {
      if (prop === 'addPage') {
        return () => {
          overflowed = true;
          return proxy;
        };
      }
      if (typeof prop === 'string' && silent.has(prop)) return () => proxy;
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return { doc: proxy, overflowed: () => overflowed };
}

/** Desenha uma música a partir de `startY` e devolve onde ela terminou. */
type Drawer = (doc: jsPDF, startY: number) => number;

/** Cifra com acordes. Cuida da quebra de página e nunca separa um acorde da sua letra. */
function chordsDrawer(song: Song, geom: Geom, note?: string): Drawer {
  const { pageWidth, contentWidth } = geom;
  const lines = renderSongToLines(song);

  // Ajusta a fonte para que a linha mais longa caiba na página.
  const longest = lines.reduce((max, l) => Math.max(max, l.text.length), 0);
  const fitted = longest > 0 ? contentWidth / (COURIER_CHAR_RATIO * longest) : BASE_FONT_SIZE;
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(BASE_FONT_SIZE, fitted));
  const maxChars = Math.floor(contentWidth / (COURIER_CHAR_RATIO * fontSize));
  const lineHeight = fontSize * 1.25;
  const bottomLimit = bottomOf(geom);

  return (doc, startY) => {
    const { title, artist, key, tempo, capo } = song.metadata;
    let y = startY;

    const ensureSpace = (height: number) => {
      if (y + height > bottomLimit) {
        doc.addPage();
        y = TOP;
      }
    };

    // ── Cabeçalho da música ──────────────────────────────────────────────
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

    doc.setDrawColor(...COLOR_RULE);
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
    y += lineHeight * 1.4;

    // ── Corpo ────────────────────────────────────────────────────────────
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
    return y;
  };
}

/** Letra em fonte de leitura, maior que a da cifra: é para cantar a distância. */
const LYRICS_FONT_SIZE = 13;
const LYRICS_LINE_HEIGHT = 17;

/** Só a letra, para quem canta. A `note` é a parte da missa, em cima do título. */
function lyricsDrawer(song: Song, geom: Geom, note?: string): Drawer {
  const { contentWidth } = geom;
  const bottomLimit = bottomOf(geom);
  const lines = renderSongLyricsOnly(song);

  return (doc, startY) => {
    let y = startY;
    const ensureSpace = (height: number) => {
      if (y + height > bottomLimit) {
        doc.addPage();
        y = TOP;
      }
    };

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

    for (const line of lines) {
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
    return y;
  };
}

/** A folha no lugar da cifra: o título em cima e cada página ocupando a folha toda. */
function imagesDrawer(song: Song, images: readonly PdfImage[], geom: Geom, note?: string): Drawer {
  return (doc, startY) => {
    images.forEach((image, index) => {
      if (index > 0) doc.addPage();
      let y = index === 0 ? startY : TOP;

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
    // A folha ocupa a página: a próxima música começa em outra.
    return Number.POSITIVE_INFINITY;
  };
}

/**
 * Coloca uma música: onde a anterior terminou, se ela couber inteira no resto da
 * folha; senão, no alto da folha seguinte. Devolve onde ela terminou e a página em
 * que começou (para o sumário).
 */
function placeSong(
  doc: jsPDF,
  geom: Geom,
  y: number,
  draw: Drawer,
  { gap = SONG_GAP, ownPage = false }: { gap?: number; ownPage?: boolean } = {},
): { y: number; page: number } {
  if (y > TOP) {
    if (!ownPage && Number.isFinite(y)) {
      const test = probe(doc);
      draw(test.doc, y + gap);
      if (!test.overflowed()) {
        // Divide a folha com a anterior: um fio separa as duas.
        doc.setDrawColor(...COLOR_RULE);
        doc.line(PAGE_MARGIN, y + gap / 2 - 6, geom.pageWidth - PAGE_MARGIN, y + gap / 2 - 6);
        const page = doc.getNumberOfPages();
        return { y: draw(doc, y + gap), page };
      }
    }
    doc.addPage();
  }
  const page = doc.getNumberOfPages();
  return { y: draw(doc, TOP), page };
}

function drawerFor(entry: PlaylistPdfEntry, geom: Geom, lyricsOnly: boolean): Drawer {
  if (entry.images?.length) return imagesDrawer(entry.song, entry.images, geom, entry.note);
  return lyricsOnly
    ? lyricsDrawer(entry.song, geom, entry.note)
    : chordsDrawer(entry.song, geom, entry.note);
}

/* ==========================================================================
   Sumário
   ========================================================================== */

const TOC_HEADER = 60;
const TOC_ROW = 18;
const TOC_ROW_WITH_DETAIL = 28;

const tocDetail = (entry: PlaylistPdfEntry) =>
  [entry.part, entry.song.metadata.artist].filter(Boolean).join(' · ');

/** Onde cada linha do sumário vai ficar. Calculado antes, para reservar as folhas. */
function planToc(entries: readonly PlaylistPdfEntry[], geom: Geom) {
  const rows: { page: number; y: number }[] = [];
  let page = 1;
  let y = TOP + TOC_HEADER;
  for (const entry of entries) {
    const height = tocDetail(entry) ? TOC_ROW_WITH_DETAIL : TOC_ROW;
    if (y + height > bottomOf(geom)) {
      page++;
      y = TOP;
    }
    rows.push({ page, y });
    y += height;
  }
  return { rows, pages: page };
}

function drawToc(
  doc: jsPDF,
  geom: Geom,
  entries: readonly PlaylistPdfEntry[],
  plan: ReturnType<typeof planToc>,
  songPages: readonly number[],
  { title, lyricsOnly }: { title: string; lyricsOnly: boolean },
): void {
  const { pageWidth } = geom;
  doc.setPage(1);

  let y = TOP;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_LYRIC);
  doc.text(title, PAGE_MARGIN, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_MUTED);
  const date = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const count = `${entries.length} ${entries.length === 1 ? 'música' : 'músicas'}`;
  doc.text(`${count}  ·  ${date}`, PAGE_MARGIN, y);
  y += 16;

  doc.setDrawColor(...COLOR_RULE);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);

  const right = pageWidth - PAGE_MARGIN;
  entries.forEach((entry, index) => {
    const row = plan.rows[index]!;
    doc.setPage(row.page);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_LYRIC);
    doc.text(`${index + 1}.`, PAGE_MARGIN, row.y);
    doc.text(entry.song.metadata.title || 'Sem título', PAGE_MARGIN + 20, row.y);

    const detail = tocDetail(entry);
    if (detail) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(detail, PAGE_MARGIN + 20, row.y + 11);
    }

    // Quem canta não precisa do tom; quem toca, sim.
    const key = entry.song.metadata.key;
    if (key && !lyricsOnly && !entry.images?.length) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_CHORD);
      doc.text(key, right - 34, row.y, { align: 'right' });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(String(songPages[index] ?? ''), right, row.y, { align: 'right' });
  });
}

/** Numera todas as páginas no rodapé. */
function drawPageNumbers(doc: jsPDF, geom: Geom): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`${page}/${total}`, geom.pageWidth - PAGE_MARGIN, geom.pageHeight - PAGE_MARGIN + 8, {
      align: 'right',
    });
  }
}

/* ==========================================================================
   Montagem
   ========================================================================== */

export interface BuiltPdf {
  readonly doc: jsPDF;
  /** Com a extensão. */
  readonly filename: string;
  readonly pages: number;
}

/**
 * Monta o PDF de uma ou mais músicas, sem baixar: quem chama decide se mostra a
 * prévia ou salva.
 *
 * As músicas devem chegar **já transpostas** para o tom de execução — assim o
 * sumário e os cabeçalhos mostram o tom que você vai tocar, não o original.
 */
export async function buildPlaylistPdf(
  entries: readonly PlaylistPdfEntry[],
  { title, lyricsOnly = false, toc = false, filename }: PlaylistPdfOptions = {},
): Promise<BuiltPdf> {
  const { doc, geom } = await createDoc();

  let plan: ReturnType<typeof planToc> | null = null;
  let y = TOP;
  let gap = SONG_GAP;

  if (toc && entries.length > 0) {
    // As folhas do sumário ficam reservadas; as páginas só se sabem no fim.
    plan = planToc(entries, geom);
    for (let page = 1; page < plan.pages; page++) doc.addPage();
    y = Number.POSITIVE_INFINITY;
  } else if (title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...COLOR_LYRIC);
    doc.text(title, PAGE_MARGIN, y);
    y += 26;
    gap = 0;
  }

  const songPages: number[] = [];
  for (const entry of entries) {
    const placed = placeSong(doc, geom, y, drawerFor(entry, geom, lyricsOnly), {
      gap,
      ownPage: Boolean(entry.images?.length),
    });
    songPages.push(placed.page);
    y = placed.y;
    gap = SONG_GAP;
  }

  if (plan) drawToc(doc, geom, entries, plan, songPages, { title: title ?? '', lyricsOnly });
  drawPageNumbers(doc, geom);

  const base = filename ?? (slugify(title ?? entries[0]?.song.metadata.title ?? '') || 'musica');
  return {
    doc,
    filename: `${base}${lyricsOnly && !filename ? '-letra' : ''}.pdf`,
    pages: doc.getNumberOfPages(),
  };
}

/** Os bytes do PDF, para a prévia e para baixar o mesmo arquivo que foi visto. */
export function pdfBytes(pdf: BuiltPdf): ArrayBuffer {
  return pdf.doc.output('arraybuffer');
}

/**
 * Gera e baixa o PDF de **uma** música.
 *
 * @param song - AST da música (já transposta, se for o caso).
 */
export async function exportSongToPdf(song: Song, options: PdfExportOptions = {}): Promise<void> {
  const pdf = await buildPlaylistPdf(
    [
      {
        song,
        ...(options.note && { note: options.note }),
        ...(options.images && { images: options.images }),
      },
    ],
    { ...(options.filename && { filename: options.filename }) },
  );
  pdf.doc.save(pdf.filename);
}

/**
 * Gera e baixa um PDF **só com a letra**, para quem canta e não toca.
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
  const pdf = await buildPlaylistPdf(entries, {
    lyricsOnly: true,
    ...(heading && { title: heading }),
    ...(options.filename && { filename: options.filename }),
  });
  pdf.doc.save(pdf.filename);
}

/** Gera e baixa **um único PDF** com a playlist inteira, com sumário. */
export async function exportPlaylistToPdf(
  entries: readonly PlaylistPdfEntry[],
  playlistName: string,
  options: PdfExportOptions = {},
): Promise<void> {
  if (entries.length === 0) return;
  const pdf = await buildPlaylistPdf(entries, {
    title: playlistName,
    toc: true,
    ...(options.filename && { filename: options.filename }),
  });
  pdf.doc.save(pdf.filename);
}
