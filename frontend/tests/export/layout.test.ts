import { describe, it, expect } from 'vitest';
import { parse } from '../../src/lib/parser';
import { buildChordLyricPair, renderSongToLines, songToPlainText } from '../../src/lib/export/layout';

/** Parseia uma linha simples e devolve o par acorde/letra renderizado. */
function pairOf(content: string) {
  const { song } = parse(`---\ntitle: T\n---\n${content}`);
  const line = song.sections.flatMap((s) => s.lines).find((l) => l.type !== 'empty')!;
  return buildChordLyricPair(line);
}

describe('buildChordLyricPair — alinhamento acorde/letra', () => {
  it('posiciona cada acorde exatamente acima da sua sílaba', () => {
    const { chords, lyrics } = pairOf('[G]Porque Ele [C]vive');

    expect(lyrics).toBe('Porque Ele vive');
    expect(chords).toBe('G          C');

    // O 'C' fica na mesma coluna em que 'vive' começa.
    expect(chords.indexOf('C')).toBe(lyrics.indexOf('vive'));
    expect(chords.indexOf('G')).toBe(lyrics.indexOf('Porque'));
  });

  it('mantém pelo menos um espaço quando o acorde é mais largo que a sílaba', () => {
    const { chords, lyrics } = pairOf('[Bm7(b5)]Oi [C]tudo');

    // Sem colisão: os dois acordes ficam separados.
    expect(chords).toBe('Bm7(b5) C');
    // A letra foi empurrada para preservar o alinhamento do 2º acorde.
    expect(chords.indexOf('C')).toBe(lyrics.indexOf('tudo'));
  });

  it('lida com letra sem acorde', () => {
    const { chords, lyrics } = pairOf('Somente a letra');
    expect(chords).toBe('');
    expect(lyrics).toBe('Somente a letra');
  });

  it('lida com acorde no meio de uma palavra', () => {
    const { chords, lyrics } = pairOf('ama[G]nhã');
    expect(lyrics).toBe('amanhã');
    expect(chords.indexOf('G')).toBe(3);
  });

  it('não deixa espaços à direita', () => {
    const { chords, lyrics } = pairOf('[G]Fim   ');
    expect(chords).toBe(chords.replace(/\s+$/, ''));
    expect(lyrics).toBe(lyrics.replace(/\s+$/, ''));
  });
});

describe('renderSongToLines', () => {
  const SONG = `---
title: Teste
---
{verso 1}
[G]Porque Ele [C]vive

{refrão}
[D]Canta
`;

  it('emite rótulo, acordes e letra na ordem certa', () => {
    const { song } = parse(SONG);
    const lines = renderSongToLines(song);
    const kinds = lines.map((l) => l.kind);

    expect(kinds[0]).toBe('label');
    expect(lines[0]!.text).toBe('Verso 1');
    expect(kinds[1]).toBe('chord');
    expect(kinds[2]).toBe('lyric');

    // O refrão aparece depois, com seu rótulo.
    expect(lines.some((l) => l.kind === 'label' && l.text === 'Refrão')).toBe(true);
  });

  it('não termina com linha em branco nem duplica brancos', () => {
    const { song } = parse(SONG);
    const lines = renderSongToLines(song);
    expect(lines[lines.length - 1]!.kind).not.toBe('blank');
    lines.forEach((l, i) => {
      if (l.kind === 'blank') expect(lines[i + 1]?.kind).not.toBe('blank');
    });
  });
});

describe('songToPlainText', () => {
  it('inclui cabeçalho com título, artista e metadados', () => {
    const { song } = parse(`---
title: Mãos ao Alto
artist: Domínio Público
key: D
tempo: 72
---
{verso 1}
[D]Ergo minhas mãos
`);
    const text = songToPlainText(song);

    expect(text).toContain('Mãos ao Alto');
    expect(text).toContain('Domínio Público');
    expect(text).toContain('Tom: D');
    expect(text).toContain('72 BPM');
    expect(text).toContain('[Verso 1]');
    // Acorde acima da letra
    expect(text).toContain('D\nErgo minhas mãos');
  });
});
