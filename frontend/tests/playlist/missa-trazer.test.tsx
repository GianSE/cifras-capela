import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { playlistStorage } from '../../src/lib/storage/playlists';
import { ImportPage } from '../../src/pages/ImportPage';
import { songService } from '../../src/services/song-service';
import { importFromUrl } from '../../src/lib/import/url-importer';
import type { SongIndexEntry } from '../../src/types/library';

vi.mock('../../src/lib/import/url-importer', () => ({
  importFromUrl: vi.fn(),
  isUrlImportAvailable: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../src/components/auth/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));

let library: SongIndexEntry[] = [];
vi.mock('../../src/hooks/useSongLibrary', () => ({
  useSongLibrary: () => ({ songs: library, isLoading: false }),
}));

const URL_DA_MUSICA = 'https://musicasparamissa.com.br/musica/pao-da-vida/';

function Where() {
  return <p data-testid="onde">{useLocation().pathname}</p>;
}

/** Entra na tela como o botão "Trazer" das sugestões faz. */
function open(missaId: string, parteId: string) {
  const params = new URLSearchParams({ url: URL_DA_MUSICA, missa: missaId, parte: parteId });
  render(
    <MemoryRouter initialEntries={[`/importar?${params}`]}>
      <Routes>
        <Route path="/importar" element={<ImportPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('trazer uma música sugerida para a missa', () => {
  let missaId: string;
  let comunhao: string;

  beforeEach(() => {
    library = [];
    for (const p of [...playlistStorage.getSnapshot()]) playlistStorage.remove(p.id);
    missaId = playlistStorage.create('Domingo, 08/11/2026', [], 'missa');
    comunhao = playlistStorage.get(missaId)!.sections!.find((s) => s.name === 'Comunhão')!.id;
    vi.spyOn(songService, 'saveSong').mockResolvedValue(undefined as never);
    Object.defineProperty(songService, 'canWrite', { configurable: true, get: () => true });
    vi.mocked(importFromUrl).mockResolvedValue({
      title: 'Pão da Vida',
      categories: ['Comunhão'],
      body: '[G]Pão da vida',
      warnings: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('abre a revisão e diz para onde a música vai', async () => {
    open(missaId, comunhao);
    expect(await screen.findByText(/Depois de salvar/)).toBeTruthy();
    expect(screen.getByText('Comunhão · Domingo, 08/11/2026')).toBeTruthy();
    expect(importFromUrl).toHaveBeenCalledWith(URL_DA_MUSICA);
  });

  it('salva, coloca na parte certa e volta para a missa', async () => {
    open(missaId, comunhao);
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar e colocar na missa' }));

    await waitFor(() =>
      expect(screen.getByTestId('onde').textContent).toBe(`/playlists/${missaId}`),
    );
    const parte = playlistStorage.get(missaId)!.sections!.find((s) => s.id === comunhao)!;
    expect(parte.songIds).toEqual(['comunhao/pao-da-vida']);
  });

  it('música repetida guardada como nova também entra na parte', async () => {
    library = [{ id: 'comunhao/pao-da-vida', title: 'Pão da Vida', filename: 'x.cho' }];
    open(missaId, comunhao);
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar e colocar na missa' }));
    fireEvent.click(await screen.findByRole('button', { name: /Guardar como nova/ }));

    await waitFor(() =>
      expect(screen.getByTestId('onde').textContent).toBe(`/playlists/${missaId}`),
    );
    const parte = playlistStorage.get(missaId)!.sections!.find((s) => s.id === comunhao)!;
    expect(parte.songIds).toEqual(['comunhao/pao-da-vida-2']);
  });

  it('se a página falhar, explica e oferece a volta para a missa', async () => {
    vi.mocked(importFromUrl).mockRejectedValue(new Error('O site respondeu 403.'));
    open(missaId, comunhao);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('O site respondeu 403.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voltar para a missa' }).getAttribute('href')).toBe(
      `/playlists/${missaId}`,
    );
  });

  it('desistir volta para a missa, sem colocar nada nela', async () => {
    open(missaId, comunhao);
    fireEvent.click(await screen.findByRole('button', { name: 'Recomeçar' }));

    expect(screen.getByTestId('onde').textContent).toBe(`/playlists/${missaId}`);
    expect(playlistStorage.get(missaId)!.songIds).toEqual([]);
  });
});
