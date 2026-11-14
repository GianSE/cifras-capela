/**
 * @module lib/export/pdf
 * @description Exporta música(s) como PDF, mantendo os acordes alinhados
 * acima da letra.
 *
 * Usa fonte monoespaçada (Courier) para que o alinhamento por coluna calculado
 * em `layout.ts` seja preservado no papel. O jsPDF é carregado sob demanda
 * (import dinâmico), então não entra no bundle inicial.
 *
 * O texto corre num {@link Flow}: desce na coluna, passa para a coluna seguinte e,
 * na última, para a folha seguinte. Numa playlist, as músicas se encaixam: a que
 * cabe inteira no que sobrou da coluna vai ali mesmo; a que não cabe começa no alto
 * da próxima, para ninguém virar a página no meio dela. Só a música maior que uma
 * coluna inteira continua na seguinte.
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
/** Espaço entre as duas colunas. */
const GUTTER = 24;

/** Espaço entre duas músicas que dividem a coluna. */
const SONG_GAP = 30;

/** Faixa do tamanho da letra que a tela oferece (1 = o tamanho de sempre). */
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.6;

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
  /** Cada música começa numa folha nova, em vez de dividir a folha. */
  readonly breakEach?: boolean;
  /** Uma ou duas colunas por folha. */
  readonly columns?: 1 | 2;
  /** Tamanho da letra: 1 é o de sempre. */
  readonly fontScale?: number;
  /** Nome do arquivo (sem extensão). */
  readonly filename?: string;
  /** Inclui o link do YouTube de cada música, quando ela tiver um salvo. */
  readonly includeYoutube?: boolean;
}

interface Geom {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly contentWidth: number;
}

const TOP = PAGE_MARGIN;
const bottomOf = (geom: Geom) => geom.pageHeight - PAGE_MARGIN - 14;

/* ==========================================================================
   O fluxo: onde a próxima linha vai
   ========================================================================== */

class Flow {
  column = 0;
  y = TOP;
  /** Onde as colunas começam nesta folha (abaixo do título, na primeira). */
  pageTop = TOP;
  /** Já há música nesta folha. */
  used = false;
  /** A folha está ocupada por inteiro (uma foto): a próxima música vai para outra. */
  closed = false;
  /** Para medir: o desenho pediu outro lugar. */
  advanced = false;

  readonly doc: jsPDF;
  readonly geom: Geom;
  readonly columns: 1 | 2;

  constructor(doc: jsPDF, geom: Geom, columns: 1 | 2) {
    this.doc = doc;
    this.geom = geom;
    this.columns = columns;
  }

  get width(): number {
    return this.columns === 1
      ? this.geom.contentWidth
      : (this.geom.contentWidth - GUTTER * (this.columns - 1)) / this.columns;
  }

  get x(): number {
    return PAGE_MARGIN + this.column * (this.width + GUTTER);
  }

  get bottom(): number {
    return bottomOf(this.geom);
  }

  get page(): number {
    return this.doc.getNumberOfPages();
  }

  /** No alto de uma coluna, sem nada nela ainda. */
  get atColumnTop(): boolean {
    return this.y === this.pageTop;
  }

  newPage(): void {
    this.doc.addPage();
    this.column = 0;
    this.pageTop = TOP;
    this.y = TOP;
    this.used = false;
    this.closed = false;
    this.advanced = true;
  }

  /** A coluna seguinte, ou a folha seguinte depois da última coluna. */
  advance(): void {
    if (this.column < this.columns - 1 && !this.closed) {
      this.column++;
      this.y = this.pageTop;
      this.advanced = true;
    } else {
      this.newPage();
    }
  }

  /** Garante espaço para `height`; se não couber aqui, vai para o próximo lugar. */
  ensure(height: number): void {
    if (this.y + height > this.bottom) this.advance();
  }

  /**
   * Uma cópia que não desenha nada, para medir uma música antes de colocá-la. O
   * desenho roda o mesmo código, então medida e resultado nunca divergem.
   */
  probe(): Flow {
    const copy = new Flow(silent(this.doc), this.geom, this.columns);
    Object.assign(copy, {
      column: this.column,
      y: this.y,
      pageTop: this.pageTop,
      used: this.used,
      closed: this.closed,
      advanced: false,
    });
    return copy;
  }
}

/** O documento, mas sem desenhar nem criar folhas: só para medir. */
function silent(doc: jsPDF): jsPDF {
  const drawing = new Set(['text', 'line', 'addImage', 'setPage', 'addPage']);
  const proxy: jsPDF = new Proxy(doc, {
    get(target, prop) {
      if (typeof prop === 'string' && drawing.has(prop)) return () => proxy;
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return proxy;
}

/* ==========================================================================
   Desenho de uma música
   ========================================================================== */

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

/** Desenha uma música a partir de onde o fluxo está. */
type Drawer = (flow: Flow) => void;

/** Título que pode quebrar em mais de uma linha, numa coluna estreita. */
function drawTitle(flow: Flow, title: string, size: number, lineHeight: number): void {
  const { doc } = flow;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...COLOR_LYRIC);
  for (const part of doc.splitTextToSize(title || 'Sem título', flow.width)) {
    doc.text(part as string, flow.x, flow.y);
    flow.y += lineHeight;
  }
}

/** O link do YouTube da música, como uma linha clicável no cabeçalho. */
function drawYoutubeLink(flow: Flow, videoId: string, scale: number): void {
  const { doc } = flow;
  const url = `https://youtu.be/${videoId}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9 * scale);
  doc.setTextColor(...COLOR_LABEL);
  doc.textWithLink(url, flow.x, flow.y, { url });
  flow.y += 13 * scale;
}

/** Cifra com acordes. Cuida da quebra de coluna e nunca separa um acorde da sua letra. */
function chordsDrawer(
  song: Song,
  width: number,
  scale: number,
  note?: string,
  includeYoutube?: boolean,
): Drawer {
  const lines = renderSongToLines(song);

  // Ajusta a fonte para que a linha mais longa caiba na coluna.
  const base = BASE_FONT_SIZE * scale;
  const longest = lines.reduce((max, l) => Math.max(max, l.text.length), 0);
  const fitted = longest > 0 ? width / (COURIER_CHAR_RATIO * longest) : base;
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(base, fitted));
  const maxChars = Math.floor(width / (COURIER_CHAR_RATIO * fontSize));
  const lineHeight = fontSize * 1.25;

  return (flow) => {
    const { doc } = flow;
    const { title, artist, key, tempo, capo, youtube } = song.metadata;

    // ── Cabeçalho da música ──────────────────────────────────────────────
    if (note) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10 * scale);
      doc.setTextColor(...COLOR_LABEL);
      doc.text(note.toUpperCase(), flow.x, flow.y);
      flow.y += 15 * scale;
    }

    drawTitle(flow, title, 18 * scale, 20 * scale);

    if (artist) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11 * scale);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(artist, flow.x, flow.y);
      flow.y += 15 * scale;
    }

    const meta = [
      key ? `Tom: ${key}` : '',
      tempo !== undefined ? `${tempo} BPM` : '',
      capo ? `Capo: ${capo}` : '',
    ].filter(Boolean);

    if (meta.length > 0) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(9 * scale);
      doc.setTextColor(...COLOR_CHORD);
      for (const part of doc.splitTextToSize(meta.join('  ·  '), flow.width)) {
        doc.text(part as string, flow.x, flow.y);
        flow.y += 12 * scale;
      }
    }

    if (includeYoutube && youtube) drawYoutubeLink(flow, youtube, scale);

    doc.setDrawColor(...COLOR_RULE);
    doc.line(flow.x, flow.y, flow.x + flow.width, flow.y);
    flow.y += lineHeight * 1.4;

    // ── Corpo ────────────────────────────────────────────────────────────
    for (const block of toBlocks(lines)) {
      if (block.kind === 'blank') {
        flow.y += lineHeight * 0.6;
        continue;
      }

      if (block.kind === 'label') {
        flow.ensure(lineHeight * 2);
        flow.y += lineHeight * 0.3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontSize * 0.95);
        doc.setTextColor(...COLOR_LABEL);
        doc.text((block.lyric ?? '').toUpperCase(), flow.x, flow.y);
        flow.y += lineHeight;
        continue;
      }

      if (block.kind === 'comment') {
        flow.ensure(lineHeight);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(fontSize * 0.9);
        doc.setTextColor(...COLOR_MUTED);
        doc.text(block.lyric ?? '', flow.x, flow.y);
        flow.y += lineHeight;
        continue;
      }

      // Par acorde/letra — nunca separados entre colunas.
      for (const [chords, lyric] of wrapPair(block.chords ?? '', block.lyric ?? '', maxChars)) {
        flow.ensure((chords ? lineHeight : 0) + (lyric ? lineHeight : 0));

        if (chords) {
          doc.setFont('courier', 'bold');
          doc.setFontSize(fontSize);
          doc.setTextColor(...COLOR_CHORD);
          doc.text(chords, flow.x, flow.y);
          flow.y += lineHeight;
        }
        if (lyric) {
          doc.setFont('courier', 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(...COLOR_LYRIC);
          doc.text(lyric, flow.x, flow.y);
          flow.y += lineHeight;
        }
      }
    }
  };
}

/** Letra em fonte de leitura, maior que a da cifra: é para cantar a distância. */
const LYRICS_FONT_SIZE = 13;
const LYRICS_LINE_HEIGHT = 17;

/** Só a letra, para quem canta. A `note` é a parte da missa, em cima do título. */
function lyricsDrawer(
  song: Song,
  scale: number,
  note?: string,
  includeYoutube?: boolean,
): Drawer {
  const lines = renderSongLyricsOnly(song);
  const size = LYRICS_FONT_SIZE * scale;
  const lineHeight = LYRICS_LINE_HEIGHT * scale;

  return (flow) => {
    const { doc } = flow;

    if (note) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10 * scale);
      doc.setTextColor(...COLOR_LABEL);
      doc.text(note.toUpperCase(), flow.x, flow.y);
      flow.y += 15 * scale;
    }

    drawTitle(flow, song.metadata.title, 15 * scale, 18 * scale);
    flow.y += 4 * scale;

    if (includeYoutube && song.metadata.youtube) {
      drawYoutubeLink(flow, song.metadata.youtube, scale);
      flow.y += 2 * scale;
    }

    for (const line of lines) {
      if (line.kind === 'blank') {
        flow.y += lineHeight * 0.6;
        continue;
      }

      if (line.kind === 'label') {
        // Junto da primeira linha que ele nomeia, nunca sozinho no fim da coluna.
        flow.ensure(lineHeight * 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10 * scale);
        doc.setTextColor(...COLOR_MUTED);
        doc.text(line.text.toUpperCase(), flow.x, flow.y);
        flow.y += 14 * scale;
        continue;
      }

      const isComment = line.kind === 'comment';
      doc.setFont('helvetica', isComment ? 'italic' : 'normal');
      doc.setFontSize(isComment ? size - 2 : size);
      doc.setTextColor(...(isComment ? COLOR_MUTED : COLOR_LYRIC));
      for (const part of doc.splitTextToSize(line.text, flow.width)) {
        flow.ensure(lineHeight);
        doc.text(part as string, flow.x, flow.y);
        flow.y += lineHeight;
      }
    }
  };
}

/**
 * A folha no lugar da cifra: o título em cima e cada página ocupando a folha toda,
 * por cima das colunas. Começa sempre numa folha própria.
 */
function imagesDrawer(
  song: Song,
  images: readonly PdfImage[],
  note?: string,
  includeYoutube?: boolean,
): Drawer {
  return (flow) => {
    const { doc, geom } = flow;
    images.forEach((image, index) => {
      if (index > 0) flow.newPage();
      let y = flow.y;

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

        if (includeYoutube && song.metadata.youtube) {
          flow.y = y;
          drawYoutubeLink(flow, song.metadata.youtube, 1);
          y = flow.y;
        }
      }

      const height = geom.pageHeight - y - PAGE_MARGIN - 14;
      const scale = Math.min(geom.contentWidth / image.width, height / image.height);
      doc.addImage(image.data, 'JPEG', PAGE_MARGIN, y, image.width * scale, image.height * scale);
    });
    flow.closed = true;
  };
}

/**
 * Coloca uma música e devolve a página em que ela começou (para o sumário).
 *
 * Juntando, ela vai onde a anterior terminou se couber inteira no resto da coluna;
 * senão, no alto da coluna seguinte. Separando, cada música abre uma folha nova.
 */
function placeSong(
  flow: Flow,
  draw: Drawer,
  { gap, ownPage, breakEach }: { gap: number; ownPage: boolean; breakEach: boolean },
): number {
  if (flow.closed || ((ownPage || breakEach) && flow.used)) {
    flow.newPage();
  } else if (ownPage && (flow.column > 0 || !flow.atColumnTop)) {
    flow.newPage();
  } else if (!flow.atColumnTop) {
    const test = flow.probe();
    test.y += gap;
    draw(test);
    if (!test.advanced) {
      // Divide a coluna com a anterior: um fio separa as duas.
      const rule = flow.y + gap / 2 - 6;
      flow.doc.setDrawColor(...COLOR_RULE);
      flow.doc.line(flow.x, rule, flow.x + flow.width, rule);
      flow.y += gap;
    } else {
      flow.advance();
    }
  }

  const page = flow.page;
  draw(flow);
  flow.used = true;
  return page;
}

function drawerFor(
  entry: PlaylistPdfEntry,
  width: number,
  lyricsOnly: boolean,
  scale: number,
  includeYoutube: boolean,
): Drawer {
  if (entry.images?.length) {
    return imagesDrawer(entry.song, entry.images, entry.note, includeYoutube);
  }
  return lyricsOnly
    ? lyricsDrawer(entry.song, scale, entry.note, includeYoutube)
    : chordsDrawer(entry.song, width, scale, entry.note, includeYoutube);
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

const clampScale = (value: number | undefined) =>
  Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value ?? 1));

/**
 * Monta o PDF de uma ou mais músicas, sem baixar: quem chama decide se mostra a
 * prévia ou salva.
 *
 * As músicas devem chegar **já transpostas** para o tom de execução — assim o
 * sumário e os cabeçalhos mostram o tom que você vai tocar, não o original.
 */
export async function buildPlaylistPdf(
  entries: readonly PlaylistPdfEntry[],
  {
    title,
    lyricsOnly = false,
    toc = false,
    breakEach = false,
    columns = 1,
    fontScale,
    filename,
    includeYoutube = false,
  }: PlaylistPdfOptions = {},
): Promise<BuiltPdf> {
  const { doc, geom } = await createDoc();
  const scale = clampScale(fontScale);
  const flow = new Flow(doc, geom, columns);

  let plan: ReturnType<typeof planToc> | null = null;
  let gap = SONG_GAP;

  if (toc && entries.length > 0) {
    // As folhas do sumário ficam reservadas; as páginas só se sabem no fim.
    plan = planToc(entries, geom);
    for (let page = 1; page < plan.pages; page++) doc.addPage();
    flow.newPage();
  } else if (title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...COLOR_LYRIC);
    doc.text(title, PAGE_MARGIN, TOP);
    // As colunas desta folha começam abaixo do título.
    flow.pageTop = TOP + 26;
    flow.y = flow.pageTop;
    gap = 0;
  }

  const songPages: number[] = [];
  for (const entry of entries) {
    songPages.push(
      placeSong(flow, drawerFor(entry, flow.width, lyricsOnly, scale, includeYoutube), {
        gap,
        ownPage: Boolean(entry.images?.length),
        breakEach,
      }),
    );
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
