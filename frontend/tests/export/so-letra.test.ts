import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from '../../src/lib/parser';
import { renderSongLyricsOnly } from '../../src/lib/export/layout';
import { exportLyricsToPdf } from '../../src/lib/export/pdf';

/** Registra o que iria para o papel, sem depender do desenho real do jsPDF. */
const printed = vi.hoisted(() => ({ texts: [] as string[], saved: [] as string[], pages: 0 }));

vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setPage() {}
    getNumberOfPages = () => printed.pages + 1;
    addPage() {
      printed.pages++;
    }
    splitTextToSize = (text: string) => [text];
    text(text: string) {
      printed.texts.push(text);
    }
    save(name: string) {
      printed.saved.push(name);
    }
  },
}));

const song = (body: string, title = 'Santo') =>
  parse(`---\ntitle: ${title}\nkey: G\ncapo: 2\n---\n${body}`).song;

describe('renderSongLyricsOnly', () => {
  it('tira os acordes e não deixa buracos na letra', () => {
    const lines = renderSongLyricsOnly(song('[Bm7(b5)]Oi [C]tudo [G]bem'));
    expect(lines).toEqual([{ kind: 'lyric', text: 'Oi tudo bem' }]);
  });

  it('remenda a palavra que o acorde partiu ao meio', () => {
    const [line] = renderSongLyricsOnly(song('Se[G]nhor te lou[C]vamos'));
    expect(line?.text).toBe('Senhor te louvamos');
  });

  it('some com a linha só de acordes', () => {
    const lines = renderSongLyricsOnly(song('[G] [D] [Em]\nPorque Ele vive'));
    expect(lines.map((l) => l.text)).toEqual(['Porque Ele vive']);
  });

  it('some com a seção sem nada para cantar, e com o rótulo dela', () => {
    const lines = renderSongLyricsOnly(song('{intro}\n[G] [D]\n\n{refrão}\n[G]Aleluia'));
    expect(lines.map((l) => l.text.toLowerCase())).toEqual(['refrão', 'aleluia']);
  });

  it('mantém rótulos e o espaço entre as seções', () => {
    const lines = renderSongLyricsOnly(song('{verso 1}\nPrimeira\n\n{refrão}\nSegunda'));
    expect(lines.map((l) => l.kind)).toEqual(['label', 'lyric', 'blank', 'label', 'lyric']);
  });

  it('tira o rótulo instrumental quando a letra vem depois dele, na mesma seção', () => {
    // É assim que as cifras reais chegam dos sites.
    const lines = renderSongLyricsOnly(song('{Intro}\n[F] [Bb9]\n\nEu quero estar'));
    expect(lines).toEqual([{ kind: 'lyric', text: 'Eu quero estar' }]);
  });

  it('desfaz a sílaba esticada, sem mexer no hífen de verdade', () => {
    const lines = renderSongLyricsOnly(song('Para me DES---POSAR\nCanto de pós-comunhão---'));
    expect(lines.map((l) => l.text)).toEqual(['Para me DESPOSAR', 'Canto de pós-comunhão']);
  });

  it('tira acordes que ficaram como texto, mas não palavras parecidas', () => {
    const lines = renderSongLyricsOnly(song('Gm C7/4\nAmém\nDó de mim'));
    expect(lines.map((l) => l.text)).toEqual(['Amém', 'Dó de mim']);
  });

  it('música sem letra nenhuma não gera linha', () => {
    expect(renderSongLyricsOnly(song('[G] [D]'))).toEqual([]);
  });
});

describe('exportLyricsToPdf', () => {
  beforeEach(() => {
    printed.texts = [];
    printed.saved = [];
    printed.pages = 0;
  });

  it('não imprime acorde, tom nem capo', async () => {
    await exportLyricsToPdf([{ song: song('[G]Santo, [Em7]santo') }]);
    const all = printed.texts.join('\n');
    expect(all).toContain('Santo, santo');
    expect(all).not.toMatch(/Em7|Tom:|Capo/);
    expect(printed.saved).toEqual(['santo-letra.pdf']);
  });

  it('na missa, põe as músicas em sequência com o nome da parte', async () => {
    await exportLyricsToPdf(
      [
        { song: song('[G]Vinde', 'Canto de entrada'), note: 'Entrada' },
        { song: song('[C]Tomai', 'Canto de comunhão'), note: 'Comunhão' },
      ],
      'Missa · Domingo, 08/11/2026',
    );

    expect(printed.texts.slice(0, 7)).toEqual([
      'Missa · Domingo, 08/11/2026',
      'ENTRADA',
      'Canto de entrada',
      'Vinde',
      'COMUNHÃO',
      'Canto de comunhão',
      'Tomai',
    ]);
    // Sem uma folha para cada música.
    expect(printed.pages).toBe(0);
    expect(printed.saved).toEqual(['missa-domingo-08-11-2026-letra.pdf']);
  });

  it('música longa passa para a folha seguinte', async () => {
    const body = Array.from({ length: 80 }, (_, i) => `Linha ${i}`).join('\n');
    await exportLyricsToPdf([{ song: song(body) }]);
    expect(printed.pages).toBeGreaterThan(0);
    expect(printed.texts).toContain('Linha 79');
  });

  it('sem música, não gera arquivo', async () => {
    await exportLyricsToPdf([]);
    expect(printed.saved).toEqual([]);
  });
});
