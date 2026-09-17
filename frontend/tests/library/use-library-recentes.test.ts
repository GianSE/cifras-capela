import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SongIndexEntry } from '@/types/library';

const songs = Array.from({ length: 15 }, (_, i) => ({
  id: `culto/musica-${String(i).padStart(2, '0')}`,
  title: `Música ${String.fromCharCode(65 + i)}`,
  filename: `musica-${i}.cho`,
  categories: ['culto'],
})) as unknown as SongIndexEntry[];

vi.mock('@/hooks/useSongLibrary', () => ({
  useSongLibrary: () => ({
    songs,
    isLoading: false,
    error: null,
    source: 'network',
    staleSince: null,
  }),
}));

const { useLibrary } = await import('@/hooks/useLibrary');

describe('useLibrary — filtro de recentes', () => {
  // Abertas da mais nova para a mais antiga, com uma apagada no meio.
  const recent = [
    'culto/musica-14',
    'culto/apagada',
    ...Array.from({ length: 12 }, (_, i) => `culto/musica-${String(i).padStart(2, '0')}`),
  ];

  it('mostra só as 10 últimas, na ordem em que foram abertas', () => {
    const { result } = renderHook(() =>
      useLibrary({ ids: recent, keepIdOrder: true, maxIds: 10 }),
    );
    const expected = recent.filter((id) => id !== 'culto/apagada').slice(0, 10);
    expect(result.current.results.map((s) => s.id)).toEqual(expected);
  });

  it('sem keepIdOrder continua em ordem alfabética', () => {
    const ids = ['culto/musica-03', 'culto/musica-01'];
    const { result } = renderHook(() => useLibrary({ ids }));
    expect(result.current.results.map((s) => s.id)).toEqual(['culto/musica-01', 'culto/musica-03']);
  });
});
