import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { parse } from '../../src/lib/parser';
import { transposeSong } from '../../src/lib/transpose';
import { SongRenderer } from '../../src/components/song/SongRenderer';

const CHO = `---
title: Teste
---
{verso 1}
[G]Porque Ele [C]vive
`;

describe('SongRenderer', () => {
  it('renderiza a letra e os acordes acima dela', () => {
    const { song } = parse(CHO);
    const { container } = render(<SongRenderer song={song} fontSize={18} />);

    // Letra presente
    expect(container.textContent).toContain('Porque Ele');
    expect(container.textContent).toContain('vive');

    // Acordes renderizados como .chord-badge
    const chords = Array.from(container.querySelectorAll('.chord-badge')).map(
      (el) => el.textContent,
    );
    expect(chords).toContain('G');
    expect(chords).toContain('C');
  });

  it('aplica o tamanho de fonte informado', () => {
    const { song } = parse(CHO);
    const { container } = render(<SongRenderer song={song} fontSize={24} />);
    const article = container.querySelector('article');
    expect(article?.getAttribute('style')).toContain('font-size: 24px');
  });

  it('renderiza extensões e acidentes em tamanho uniforme (sem sobrescrito)', () => {
    const { song } = parse(`---
title: T
---
[A7]Sete [Bm7(b5)]meio [F#m]sus [G/B]baixo
`);
    const { container } = render(<SongRenderer song={song} />);

    // Nada de <sup>: na cifra o número tem o mesmo tamanho da letra.
    expect(container.querySelectorAll('sup')).toHaveLength(0);

    // O acorde sai inteiro, exatamente como escrito.
    const chords = Array.from(container.querySelectorAll('.chord-badge')).map(
      (el) => el.textContent,
    );
    expect(chords).toEqual(['A7', 'Bm7(b5)', 'F#m', 'G/B']);

    // Nenhum pedaço do acorde é reduzido de tamanho.
    for (const el of container.querySelectorAll('.chord-badge *')) {
      expect(el.className).not.toMatch(/text-\[0\./);
    }
  });

  it('acorde no fim da linha fica acima da letra, não ao lado dela', () => {
    // Caso real de "Porque Ele Vive": o [D7] fecha a frase sem sílaba depois.
    const { song } = parse(`---\ntitle: T\n---\nEstá nas mãos do meu Je[Am]sus [D7]\n`);
    const { container } = render(<SongRenderer song={song} />);

    const segments = container.querySelectorAll('.song-segment');

    // Toda coluna tem as DUAS linhas (acorde e letra), mesmo a do acorde solto.
    // É isso que impede o acorde de cair na altura da letra.
    for (const segment of segments) {
      expect(segment.querySelector('.song-segment-chord')).not.toBeNull();
      expect(segment.querySelector('.song-segment-lyric')).not.toBeNull();
    }

    // A última coluna é o [D7] sem letra.
    const last = segments[segments.length - 1]!;
    expect(last.querySelector('.chord-badge')?.textContent).toBe('D7');
    expect(last.querySelector('.song-segment-lyric')?.textContent?.trim()).toBe('');
  });

  it('mostra o acorde transposto, mantendo o tamanho uniforme', () => {
    const { song } = parse(`---\ntitle: T\n---\n[A7]Sete\n`);
    const transposed = transposeSong(song, 2, false);
    const { container } = render(<SongRenderer song={transposed} />);

    expect(container.querySelector('.chord-badge')?.textContent).toBe('B7');
    expect(container.querySelectorAll('sup')).toHaveLength(0);
  });
});
