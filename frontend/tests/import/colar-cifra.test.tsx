import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import {
  hintFromUrl,
  importFromUrl,
  importPastedText,
  siteNameOf,
} from '../../src/lib/import/url-importer';
import { playlistStorage } from '../../src/lib/storage/playlists';
import { songService } from '../../src/services/song-service';
import { ImportPage } from '../../src/pages/ImportPage';

const TERRA_SECA = 'https://www.cifraclub.com.br/fraternidade-sao-joao-paulo-ii/terra-seca/';

const COPIADA = `[Intro] G  D  Em  C

G              D
Terra seca, eu estou aqui
Em           C
Tua chuva vem sobre mim`;

describe('o que o endereço diz', () => {
  it('nome do site', () => {
    expect(siteNameOf(TERRA_SECA)).toBe('CifraClub');
    expect(siteNameOf('https://musicasparamissa.com.br/musica/x/')).toBe('Músicas para Missa');
    expect(siteNameOf('https://exemplo.com/a')).toBe('exemplo.com');
    expect(siteNameOf('não é link')).toBe('site');
  });

  it('título e artista do caminho', () => {
    expect(hintFromUrl(TERRA_SECA)).toEqual({
      title: 'Terra seca',
      artist: 'Fraternidade sao joao paulo ii',
    });
    expect(hintFromUrl('https://musicasparamissa.com.br/musica/santo-forte/')).toEqual({
      title: 'Santo forte',
    });
    expect(hintFromUrl('nada')).toEqual({});
  });
});

describe('a cifra colada', () => {
  it('vira cifra com acordes, e o nome vem da busca, com acento', () => {
    const song = importPastedText(COPIADA, TERRA_SECA, {
      title: 'Terra Seca',
      artist: 'Fraternidade São João Paulo II',
    });
    expect(song.title).toBe('Terra Seca');
    expect(song.artist).toBe('Fraternidade São João Paulo II');
    expect(song.body).toContain('[G]Terra seca');
    expect(song.warnings.some((w) => /Copiada do CifraClub/.test(w))).toBe(true);
  });

  it('sem a busca, o nome sai do endereço', () => {
    const song = importPastedText(COPIADA, TERRA_SECA);
    expect(song.title).toBe('Terra seca');
    expect(song.artist).toBe('Fraternidade sao joao paulo ii');
  });

  it('o título escrito no texto colado vale mais', () => {
    expect(importPastedText(`Título: Outro Nome\n${COPIADA}`, TERRA_SECA).title).toBe('Outro Nome');
  });
});

describe('o site recusando a leitura', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explica que foi o site, e pede para colar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'O site respondeu 403.' }, { status: 502 })),
    );
    await expect(importFromUrl(TERRA_SECA)).rejects.toThrow(
      'O CifraClub não deixa o app ler a página (403). Copie a cifra no site e cole aqui.',
    );
  });

  it('outros erros seguem como vieram', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'Esse endereço não pode ser buscado.' }, { status: 400 }),
      ),
    );
    await expect(importFromUrl('https://x.com')).rejects.toThrow(
      'Esse endereço não pode ser buscado.',
    );
  });
});

vi.mock('../../src/components/auth/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../src/hooks/useSongLibrary', () => ({
  useSongLibrary: () => ({ songs: [], isLoading: false }),
}));

function Where() {
  return <p data-testid="onde">{useLocation().pathname}</p>;
}

describe('na tela, vindo da missa', () => {
  let missaId: string;
  let comunhao: string;

  beforeEach(() => {
    for (const p of [...playlistStorage.getSnapshot()]) playlistStorage.remove(p.id);
    missaId = playlistStorage.create('Domingo, 08/11/2026', [], 'missa');
    comunhao = playlistStorage.get(missaId)!.sections!.find((s) => s.name === 'Comunhão')!.id;
    vi.spyOn(songService, 'saveSong').mockResolvedValue(undefined as never);
    Object.defineProperty(songService, 'canWrite', { configurable: true, get: () => true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) =>
        url === '/api/fetch-page' && init?.method === 'POST'
          ? Response.json({ error: 'O site respondeu 403.' }, { status: 502 })
          : new Response('', { status: 405 }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('o CifraClub recusa; colar a cifra leva à revisão e à parte certa', async () => {
    const params = new URLSearchParams({
      url: TERRA_SECA,
      missa: missaId,
      parte: comunhao,
      titulo: 'Terra Seca',
      artista: 'Fraternidade São João Paulo II',
    });
    render(
      <MemoryRouter initialEntries={[`/importar?${params}`]}>
        <Routes>
          <Route path="/importar" element={<ImportPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findByRole('alert')).textContent).toMatch(/CifraClub não deixa/);
    expect(screen.getByRole('link', { name: 'Abrir no CifraClub' }).getAttribute('href')).toBe(
      TERRA_SECA,
    );

    const usar = screen.getByRole('button', { name: 'Usar este texto' }) as HTMLButtonElement;
    expect(usar.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Cifra copiada do site'), {
      target: { value: COPIADA },
    });
    fireEvent.click(usar);

    const salvar = await screen.findByRole('button', { name: 'Salvar e colocar na missa' });
    expect((screen.getByDisplayValue('Terra Seca') as HTMLInputElement).value).toBe('Terra Seca');
    expect(screen.getByDisplayValue('Comunhão')).toBeTruthy();

    fireEvent.click(salvar);
    await waitFor(() =>
      expect(screen.getByTestId('onde').textContent).toBe(`/playlists/${missaId}`),
    );
    const parte = playlistStorage.get(missaId)!.sections!.find((s) => s.id === comunhao)!;
    expect(parte.songIds).toEqual(['comunhao/terra-seca']);
  });
});
