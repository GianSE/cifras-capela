import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { playlistStorage } from '../../src/lib/storage/playlists';
import { PlaylistsPage } from '../../src/pages/PlaylistsPage';
import { PlaylistPage } from '../../src/pages/PlaylistPage';

let userSeq = 1000;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Volta ao modo local, para o próximo teste partir de uma sessão "nova".
  playlistStorage.setSession(null);
});

/**
 * Simula o que `/api/playlists` devolveria para esta conta, e sincroniza.
 * Qualquer outra URL (auth, biblioteca...) falha como se estivesse offline —
 * os hooks delas já sabem cair para um estado vazio nesse caso.
 */
function syncAs(playlists: unknown[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/playlists')) return Response.json({ playlists });
      throw new Error('offline neste teste');
    }),
  );
  playlistStorage.setSession(userSeq++);
}

const SHARED_FOREIGN = {
  id: 'pl_foreign1',
  name: 'Repertório da Missa',
  songIds: ['a/musica'],
  kind: 'lista',
  shared: true,
  isOwner: false,
  ownerName: 'Fulano',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const OWN = {
  id: 'pl_mine1',
  name: 'Minha playlist',
  songIds: [],
  kind: 'lista',
  shared: false,
  isOwner: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('listagem com playlist compartilhada por outra conta', () => {
  beforeEach(async () => {
    syncAs([OWN, SHARED_FOREIGN]);
    // `setSession` dispara a sincronização sem esperar por ela.
    await vi.waitFor(() => expect(playlistStorage.getSnapshot()).toHaveLength(2));
  });

  const renderList = () =>
    render(
      <MemoryRouter initialEntries={['/playlists']}>
        <Routes>
          <Route path="/playlists" element={<PlaylistsPage />} />
        </Routes>
      </MemoryRouter>,
    );

  it('mostra as duas, com "de Fulano" só na que não é sua', () => {
    renderList();
    expect(screen.getByText('Minha playlist')).toBeTruthy();
    expect(screen.getByText(/Repertório da Missa/)).toBeTruthy();
    expect(screen.getByText(/de Fulano/)).toBeTruthy();
  });

  it('só a sua tem botão de excluir', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'Excluir Minha playlist' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Excluir Repertório da Missa/ })).toBeNull();
  });
});

describe('abrir uma playlist compartilhada que não é sua', () => {
  beforeEach(async () => {
    syncAs([SHARED_FOREIGN]);
    await vi.waitFor(() => expect(playlistStorage.getSnapshot()).toHaveLength(1));
  });

  it('abre em modo leitura, sem renomear nem adicionar músicas', async () => {
    render(
      <MemoryRouter initialEntries={[`/playlists/${SHARED_FOREIGN.id}`]}>
        <Routes>
          <Route path="/playlists/:id" element={<PlaylistPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Repertório da Missa')).toBeTruthy();
    expect(screen.getByText(/Playlist compartilhada/)).toBeTruthy();
    expect(screen.getByText(/de Fulano/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Renomear/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Adicionar músicas/ })).toBeNull();
  });
});

describe('a própria playlist tem o interruptor de compartilhar', () => {
  beforeEach(async () => {
    syncAs([OWN]);
    await vi.waitFor(() => expect(playlistStorage.getSnapshot()).toHaveLength(1));
  });

  it('liga o compartilhamento pelo diálogo de renomear', async () => {
    render(
      <MemoryRouter initialEntries={[`/playlists/${OWN.id}`]}>
        <Routes>
          <Route path="/playlists/:id" element={<PlaylistPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Renomear/ }));
    const toggle = screen.getByRole('switch', { name: /Compartilhar com todo mundo/ });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    expect(playlistStorage.get(OWN.id)?.shared).toBe(true);
  });
});
