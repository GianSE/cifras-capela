import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { parse } from '../../src/lib/parser';
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
});
