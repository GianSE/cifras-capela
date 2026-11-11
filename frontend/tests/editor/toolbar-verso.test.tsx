import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { EditorPage } from '../../src/pages/EditorPage';
import type { SongIndexEntry } from '../../src/types/library';

function song(id: string, title: string): SongIndexEntry {
  return { id, title, filename: 'x.cho' };
}

vi.mock('../../src/hooks/useSongLibrary', () => ({
  useSongLibrary: () => ({ songs: [song('culto/nova-musica', 'Nova Música')], isLoading: false }),
}));

vi.mock('../../src/components/auth/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

/** Renderiza o editor já no modo `.cho` — é onde o atalho de seção mora. */
const renderEditor = () => {
  const result = render(
    <MemoryRouter initialEntries={['/editor']}>
      <EditorPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('radio', { name: '.cho' }));
  return result;
};

const codeField = () => screen.getByPlaceholderText(/frontmatter \+ ChordPro/);

describe('atalho de seção no editor — numeração do verso', () => {
  it('o modelo de música nova já tem "verso 1": o atalho sugere "verso 2"', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: '{verso 2}' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '{verso 1}' })).toBeNull();
  });

  it('sem nenhum verso ainda, o atalho sugere "verso 1"', () => {
    renderEditor();
    fireEvent.change(codeField(), { target: { value: '---\ntitle: T\n---\n[G]Letra\n' } });
    expect(screen.getByRole('button', { name: '{verso 1}' })).toBeTruthy();
  });

  it('acompanha o maior número já escrito, não só a contagem', () => {
    renderEditor();
    fireEvent.change(codeField(), {
      target: { value: '---\ntitle: T\n---\n{verso 1}\nA\n{verso 5}\nB\n' },
    });
    expect(screen.getByRole('button', { name: '{verso 6}' })).toBeTruthy();
  });

  it('clicar no atalho insere a seção sugerida no texto', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: '{verso 2}' }));
    expect(screen.getByRole('button', { name: '{verso 3}' })).toBeTruthy();
  });
});

describe('atalho de seção no editor — repetir o refrão', () => {
  it('o modelo de música nova já tem um refrão: o atalho de repetir aparece', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: '{refrão again}' })).toBeTruthy();
  });

  it('sem nenhum refrão escrito, o atalho de repetir não aparece', () => {
    renderEditor();
    fireEvent.change(codeField(), { target: { value: '---\ntitle: T\n---\n[G]Letra\n' } });
    expect(screen.queryByRole('button', { name: '{refrão again}' })).toBeNull();
  });
});
