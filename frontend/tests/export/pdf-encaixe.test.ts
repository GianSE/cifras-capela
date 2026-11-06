import { describe, expect, it } from 'vitest';
import { parse } from '../../src/lib/parser';
import { buildPlaylistPdf, type PlaylistPdfEntry } from '../../src/lib/export/pdf';

/** Uma música com `lines` linhas de cifra (acorde + letra). */
function song(title: string, lines: number, key = 'G') {
  const body = Array.from({ length: lines }, (_, i) => `[${key}]Linha ${i} de ${title}`).join('\n');
  return parse(`---\ntitle: ${title}\nkey: ${key}\n---\n${body}`).song;
}

const entry = (title: string, lines: number, extra: Partial<PlaylistPdfEntry> = {}) => ({
  song: song(title, lines),
  ...extra,
});

/** O texto desenhado em cada página, como o jsPDF guarda internamente. */
function pagesText(doc: Awaited<ReturnType<typeof buildPlaylistPdf>>['doc']): string[] {
  const pages = (doc.internal as unknown as { pages: (string[] | null)[] }).pages;
  return pages.slice(1).map((ops) => (ops ?? []).join('\n'));
}

/** Página (a partir de 1) em que aparece o texto. */
const pageOf = (pages: string[], text: string) =>
  pages.findIndex((p) => p.includes(`(${text})`)) + 1;

describe('encaixe das músicas no PDF', () => {
  it('músicas curtas dividem a mesma folha', async () => {
    const pdf = await buildPlaylistPdf([entry('Um', 4), entry('Dois', 4), entry('Tres', 4)]);
    expect(pdf.pages).toBe(1);
    const pages = pagesText(pdf.doc);
    expect([pageOf(pages, 'Um'), pageOf(pages, 'Dois'), pageOf(pages, 'Tres')]).toEqual([1, 1, 1]);
  });

  it('a música que não cabe no resto da folha começa no alto da seguinte', async () => {
    // A primeira ocupa uns dois terços; a segunda, inteira, não cabe no terço que sobra.
    const pdf = await buildPlaylistPdf([entry('Primeira', 18), entry('Segunda', 18)]);
    const pages = pagesText(pdf.doc);
    expect(pageOf(pages, 'Primeira')).toBe(1);
    expect(pageOf(pages, 'Segunda')).toBe(2);
    // Começa no alto: o título é o primeiro texto da folha.
    expect(pages[1]!.indexOf('(Segunda)')).toBeLessThan(pages[1]!.indexOf('(Linha 0 de Segunda)'));
    // E nenhuma linha dela ficou na folha anterior.
    expect(pages[0]).not.toContain('de Segunda)');
  });

  it('música maior que uma folha começa no alto e continua na próxima', async () => {
    const pdf = await buildPlaylistPdf([entry('Curta', 3), entry('Enorme', 50)]);
    const pages = pagesText(pdf.doc);
    expect(pageOf(pages, 'Curta')).toBe(1);
    expect(pageOf(pages, 'Enorme')).toBe(2);
    expect(pages[1]).toContain('(Linha 0 de Enorme)');
    expect(pages.some((p, i) => i > 1 && p.includes('(Linha 49 de Enorme)'))).toBe(true);
  });

  it('no modo letra também encaixa', async () => {
    const pdf = await buildPlaylistPdf([entry('Um', 4), entry('Dois', 4)], { lyricsOnly: true });
    expect(pdf.pages).toBe(1);
    expect(pdf.filename).toBe('um-letra.pdf');
  });

  it('a folha (foto) fica sozinha na página', async () => {
    const image = {
      // 1×1 JPEG branco.
      data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      width: 1,
      height: 1,
    };
    const pdf = await buildPlaylistPdf([
      entry('Antes', 3),
      entry('Foto', 0, { images: [image] }),
      entry('Depois', 3),
    ]);
    const pages = pagesText(pdf.doc);
    expect([pageOf(pages, 'Antes'), pageOf(pages, 'Foto'), pageOf(pages, 'Depois')]).toEqual([
      1, 2, 3,
    ]);
  });
});

describe('sumário', () => {
  it('fica na primeira folha, com a página certa de cada música', async () => {
    const pdf = await buildPlaylistPdf(
      [entry('Curta A', 3), entry('Curta B', 3), entry('Longa', 40, { part: 'Comunhão' })],
      { title: 'Missa · Domingo, 08/11/2026', toc: true },
    );
    const pages = pagesText(pdf.doc);

    // As músicas começam depois do sumário.
    expect(pageOf(pages, 'Linha 0 de Curta A')).toBeGreaterThan(1);
    const longa = pageOf(pages, 'Linha 0 de Longa');

    const toc = pages[0]!;
    expect(toc).toContain('(Missa · Domingo, 08/11/2026)');
    expect(toc).toContain('(Comunhão)');
    // A página da longa, como foi parar no arquivo, está no sumário.
    expect(toc).toContain(`(${longa})`);
    expect(longa).toBeGreaterThan(pageOf(pages, 'Linha 0 de Curta A'));
  });

  it('para cantar, o sumário não traz o tom', async () => {
    const withKeys = await buildPlaylistPdf([entry('Um', 3)], { title: 'X', toc: true });
    const lyrics = await buildPlaylistPdf([entry('Um', 3)], {
      title: 'X',
      toc: true,
      lyricsOnly: true,
    });
    expect(pagesText(withKeys.doc)[0]).toContain('(G)');
    expect(pagesText(lyrics.doc)[0]).not.toContain('(G)');
  });

  it('sem sumário, o título vai no alto da primeira folha, junto das músicas', async () => {
    const pdf = await buildPlaylistPdf([entry('Um', 3)], { title: 'Ensaio', toc: false });
    expect(pdf.pages).toBe(1);
    const [page] = pagesText(pdf.doc);
    expect(page!.indexOf('(Ensaio)')).toBeLessThan(page!.indexOf('(Um)'));
  });

  it('sumário longo ocupa as folhas que precisar, antes das músicas', async () => {
    const many = Array.from({ length: 45 }, (_, i) => entry(`Musica ${i}`, 2));
    const pdf = await buildPlaylistPdf(many, { title: 'Muitas', toc: true });
    const pages = pagesText(pdf.doc);
    const firstSong = pages.findIndex((p) => p.includes('(Linha 0 de Musica 0)')) + 1;
    expect(firstSong).toBeGreaterThan(2);
    expect(pages[firstSong - 2]).toContain('(Musica 44)');
  });
});
