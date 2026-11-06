import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { playlistStorage } from '../../src/lib/storage/playlists';
import { PlaylistsPage } from '../../src/pages/PlaylistsPage';
import { PlaylistPage } from '../../src/pages/PlaylistPage';
import { MissaSections } from '../../src/components/playlist/MissaSections';
import type { Playlist } from '../../src/types/playlist';

/** Só o relógio é falso: os demais timers seguem normais para a tela responder. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 5, 12) }); // quinta-feira
  for (const p of [...playlistStorage.getSnapshot()]) playlistStorage.remove(p.id);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/playlists']}>
      <Routes>
        <Route path="/playlists" element={<PlaylistsPage />} />
        <Route path="/playlists/:id" element={<p>Aberta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function openNewMissa() {
  fireEvent.click(screen.getByRole('button', { name: 'Nova Playlist' }));
  fireEvent.click(screen.getByRole('radio', { name: /Missa/ }));
}

describe('criar uma missa', () => {
  it('pede só a data, já sugerindo o próximo domingo', () => {
    renderList();
    openNewMissa();

    expect(screen.queryByPlaceholderText(/Culto/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sábado, 07/11/2026' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Domingo, 08/11/2026' }).getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(playlistStorage.getSnapshot().map((p) => [p.name, p.kind])).toEqual([
      ['Domingo, 08/11/2026', 'missa'],
    ]);
  });

  it('um toque troca para o sábado', () => {
    renderList();
    openNewMissa();
    fireEvent.click(screen.getByRole('button', { name: 'Sábado, 07/11/2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(playlistStorage.getSnapshot()[0]?.name).toBe('Sábado, 07/11/2026');
  });

  it('aceita outra data, e sem data não cria', () => {
    renderList();
    openNewMissa();
    const field = screen.getByLabelText('Outra data');

    fireEvent.change(field, { target: { value: '' } });
    expect((screen.getByRole('button', { name: 'Criar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.change(field, { target: { value: '2026-12-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(playlistStorage.getSnapshot()[0]?.name).toBe('Sexta, 25/12/2026');
  });

  it('playlist comum continua pedindo um nome', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Nova Playlist' }));
    fireEvent.change(screen.getByPlaceholderText(/Culto/), { target: { value: 'Ensaio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(playlistStorage.getSnapshot()[0]?.name).toBe('Ensaio');
  });
});

describe('mudar a data de uma missa', () => {
  it('parte da data atual e troca o nome', () => {
    const id = playlistStorage.create('Domingo, 08/11/2026', [], 'missa');
    render(
      <MemoryRouter initialEntries={[`/playlists/${id}`]}>
        <Routes>
          <Route path="/playlists/:id" element={<PlaylistPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mudar data/ }));
    const field = screen.getByLabelText('Outra data') as HTMLInputElement;
    expect(field.value).toBe('2026-11-08');

    fireEvent.change(field, { target: { value: '2026-11-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(playlistStorage.get(id)?.name).toBe('Domingo, 15/11/2026');
  });
});

describe('mais de uma música na mesma parte', () => {
  const missa: Playlist = {
    id: 'pl',
    name: 'Domingo, 08/11/2026',
    kind: 'missa',
    songIds: ['a', 'b'],
    sections: [
      { id: 'vazia', name: 'Entrada', songIds: [] },
      { id: 'com', name: 'Comunhão', songIds: ['a', 'b'] },
    ],
    createdAt: '',
    updatedAt: '',
  };

  it('oferece outra música na parte que já tem música e diz quantas são', () => {
    const onAddSong = vi.fn();
    render(
      <MissaSections
        playlist={missa}
        editable
        renderSongs={(section) => <p>{section.songIds.join(' e ')}</p>}
        onAddSong={onAddSong}
      />,
    );

    expect(screen.getByText('a e b')).toBeTruthy();
    expect(screen.getByText('2 músicas')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Outra música em Comunhão/ }));
    expect(onAddSong).toHaveBeenCalledWith(expect.objectContaining({ id: 'com' }));
  });

  it('quem só lê não vê os botões de adicionar', () => {
    render(
      <MissaSections
        playlist={missa}
        editable={false}
        renderSongs={(section) => <p>{section.songIds.join(' e ')}</p>}
      />,
    );
    expect(screen.queryByRole('button', { name: /Outra música/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Escolher música/ })).toBeNull();
  });
});
