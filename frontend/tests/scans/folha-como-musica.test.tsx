import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { parse } from '../../src/lib/parser';
import { serializeToFrontmatter } from '../../src/lib/parser';
import { deriveIndexEntry, songHasContent } from '../../src/lib/library/derive';
import { getField, removeField } from '../../src/lib/editor/cho-document';
import {
  createSongFromScan,
  deleteScanAndSong,
  deleteScanKeepingSong,
  type Scan,
} from '../../src/lib/scans';
import { songService } from '../../src/services/song-service';
import { ScansPage } from '../../src/pages/ScansPage';
import type { SongIndexEntry } from '../../src/types/library';

const scan = (over: Partial<Scan> = {}): Scan => ({
  id: 'fl_abc123',
  filename: 'foto.jpg',
  contentType: 'image/jpeg',
  size: 100,
  status: 'pendente',
  songId: null,
  createdAt: '2026-11-06 10:00:00',
  updatedAt: '2026-11-06 10:00:00',
  ...over,
});

describe('a ligação com a folha mora no .cho', () => {
  const SOURCE = '---\ntitle: Foto\nscan: fl_abc123\n---\n\n';

  it('é lida como dado da música, e chega à biblioteca', () => {
    const { song } = parse(SOURCE);
    expect(song.metadata.scan).toBe('fl_abc123');
    expect(deriveIndexEntry('a/b', SOURCE).scan).toBe('fl_abc123');
  });

  it('não vira diretiva desconhecida nem aparece como letra', () => {
    const { song, errors } = parse(SOURCE);
    expect(errors.filter((e) => /scan/i.test(e.message))).toEqual([]);
    expect(song.metadata.custom['scan']).toBeUndefined();
    expect(songHasContent(song)).toBe(false);
  });

  it('sobrevive a transpor e a regravar o arquivo', () => {
    const saved = serializeToFrontmatter(parse(`${SOURCE}[G]Letra\n`).song);
    expect(saved).toContain('scan: fl_abc123');
  });

  it('sabe quando a música tem o que mostrar além da folha', () => {
    expect(songHasContent(parse(`${SOURCE}[G]Letra\n`).song)).toBe(true);
    expect(songHasContent(parse('---\ntitle: A\n---\n\n\n').song)).toBe(false);
  });

  it('apagar a ligação não mexe em mais nada', () => {
    const full = '---\ntitle: Foto\nscan: fl_abc123\nkey: G\n---\n\n[G]Letra\n';
    expect(removeField(full, 'scan')).toBe('---\ntitle: Foto\nkey: G\n---\n\n[G]Letra\n');
    expect(removeField('---\r\nscan: x\r\ntitle: A\r\n---\r\n', 'scan')).toBe(
      '---\r\ntitle: A\r\n---\r\n',
    );
    expect(removeField(full, 'tempo')).toBe(full);
    expect(removeField('scan: fora do frontmatter\n', 'scan')).toBe('scan: fora do frontmatter\n');
  });
});

describe('usar a folha como música', () => {
  let save: ReturnType<typeof vi.spyOn>;
  let patched: unknown[];

  beforeEach(() => {
    patched = [];
    save = vi.spyOn(songService, 'saveSong').mockResolvedValue(undefined as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') patched.push(JSON.parse(String(init.body)));
        return Response.json({ ok: true });
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const create = (taken: string[] = []) =>
    createSongFromScan(
      scan(),
      { title: 'Santo Forte', artist: '', key: 'G', categories: ['Santo'] },
      taken,
    );

  it('cria a música só com os dados e a ligação com a foto', async () => {
    expect(await create()).toBe('santo/santo-forte');
    const { id, source } = save.mock.calls[0]![0] as { id: string; source: string };
    expect(id).toBe('santo/santo-forte');
    const { song } = parse(source);
    expect(song.metadata.title).toBe('Santo Forte');
    expect(song.metadata.key).toBe('G');
    expect(song.metadata.scan).toBe('fl_abc123');
    expect(songHasContent(song)).toBe(false);
  });

  it('continua pendente, porque ainda não foi transcrita', async () => {
    await create();
    expect(patched).toEqual([{ songId: 'santo/santo-forte', status: 'pendente' }]);
  });

  it('nunca grava por cima de uma música que já existe', async () => {
    expect(await create(['santo/santo-forte'])).toBe('santo/santo-forte-2');
  });
});

describe('apagar a foto', () => {
  let save: ReturnType<typeof vi.spyOn>;
  let order: string[];

  beforeEach(() => {
    order = [];
    save = vi.spyOn(songService, 'saveSong').mockImplementation(async () => {
      order.push('salva a música');
    });
    vi.spyOn(songService, 'deleteSong').mockImplementation(async () => {
      order.push('apaga a música');
    });
    vi.spyOn(songService, 'getSongContent').mockResolvedValue(
      '---\ntitle: A\nscan: fl_abc123\n---\n\n[G]Letra\n',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        order.push('apaga a foto');
        return Response.json({ ok: true });
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('a música fica com o texto, sem a ligação, e a ligação sai antes da foto', async () => {
    await deleteScanKeepingSong(scan({ songId: 'a/b', status: 'validada' }));
    const { source } = save.mock.calls[0]![0] as { source: string };
    expect(getField(source, 'scan')).toBe('');
    expect(source).toContain('[G]Letra');
    expect(order).toEqual(['salva a música', 'apaga a foto']);
  });

  it('se a música foi ligada a outra folha, não mexe nela', async () => {
    vi.mocked(songService.getSongContent).mockResolvedValue(
      '---\ntitle: A\nscan: fl_outra\n---\n\n[G]Letra\n',
    );
    await deleteScanKeepingSong(scan({ songId: 'a/b' }));
    expect(save).not.toHaveBeenCalled();
    expect(order).toEqual(['apaga a foto']);
  });

  it('se salvar a música falhar, a foto continua', async () => {
    save.mockRejectedValue(new Error('Sem conexão'));
    await expect(deleteScanKeepingSong(scan({ songId: 'a/b' }))).rejects.toThrow('Sem conexão');
    expect(order).toEqual([]);
  });

  it('sem texto, apaga a música junto', async () => {
    await deleteScanAndSong(scan({ songId: 'a/b' }));
    expect(order).toEqual(['apaga a música', 'apaga a foto']);
  });
});

// ── A tela de Folhas ─────────────────────────────────────────────────────────

let library: SongIndexEntry[] = [];
vi.mock('../../src/hooks/useSongLibrary', () => ({
  useSongLibrary: () => ({ songs: library, isLoading: false }),
}));
vi.mock('../../src/components/playlist/AddToPlaylist', () => ({
  AddToPlaylist: () => <button>Playlist</button>,
}));

describe('a tela de Folhas', () => {
  function open(scans: Scan[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).startsWith('/api/scans')
          ? Response.json({ scans, aiAvailable: false })
          : new Response('', { status: 401 }),
      ),
    );
    render(
      <MemoryRouter initialEntries={['/folhas']}>
        <Routes>
          <Route path="/folhas" element={<ScansPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const section = (name: string) =>
    screen.getByRole('heading', { name }).closest('section') as HTMLElement;

  beforeEach(() => {
    library = [];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('a folha sem música oferece usar e transcrever', async () => {
    open([scan()]);
    expect(await screen.findAllByRole('button', { name: /Usar como música/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Transcrever/ })).toBeTruthy();
  });

  it('o nome é obrigatório, e criar liga a folha à música', async () => {
    const create = vi.spyOn(songService, 'saveSong').mockResolvedValue(undefined as never);
    open([scan()]);
    fireEvent.click((await screen.findAllByRole('button', { name: /Usar como música/ }))[0]!);

    const dialog = await screen.findByRole('dialog');
    const criar = within(dialog).getByRole('button', { name: 'Criar música' }) as HTMLButtonElement;
    expect(criar.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText('Nome da música'), {
      target: { value: 'Santo Forte' },
    });
    fireEvent.click(criar);

    await waitFor(() => expect(create).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(parse((create.mock.calls[0]![0] as { source: string }).source).song.metadata.scan).toBe(
      'fl_abc123',
    );
  });

  it('avisa se já existe música com esse nome', async () => {
    library = [{ id: 'x/santo', title: 'Santo', filename: 'x.cho' }];
    open([scan()]);
    fireEvent.click((await screen.findAllByRole('button', { name: /Usar como música/ }))[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nome da música'), {
      target: { value: 'santo' },
    });
    expect(await within(dialog).findByText(/pode já estar na biblioteca/)).toBeTruthy();
  });

  it('a folha em uso mostra o nome da música, e continua para transcrever', async () => {
    library = [{ id: 'a/b', title: 'Santo Forte', filename: 'x.cho', scan: 'fl_abc123' }];
    open([scan({ songId: 'a/b' })]);
    await screen.findByText('Santo Forte');
    const parte = section('Para transcrever');
    expect(within(parte).getAllByRole('link', { name: 'Abrir' })[0]?.getAttribute('href')).toBe(
      '/musica/a/b',
    );
    expect(within(parte).queryByRole('button', { name: /Usar como música/ })).toBeNull();
    expect(within(parte).getAllByRole('button', { name: /Transcrever/ })).toBeTruthy();
  });

  it('quem digitou a cifra no Editor já transcreveu', async () => {
    library = [
      { id: 'a/b', title: 'Santo', filename: 'x.cho', scan: 'fl_abc123', lyrics: 'letra' },
    ];
    open([scan({ songId: 'a/b' })]);
    await screen.findByText('Santo');
    expect(within(section('Validadas')).getByText('Santo')).toBeTruthy();
  });

  it('música apagada no Editor: a folha volta a poder virar música', async () => {
    open([scan({ songId: 'nao/existe' })]);
    expect(await screen.findAllByRole('button', { name: /Usar como música/ })).toBeTruthy();
  });

  it.each([
    ['com texto', 'letra', /A música continua/],
    ['só a foto', undefined, /Excluir apaga a música também/],
  ])('excluir avisa o que acontece: %s', async (_, lyrics, message) => {
    library = [
      {
        id: 'a/b',
        title: 'Santo',
        filename: 'x.cho',
        scan: 'fl_abc123',
        ...(lyrics && { lyrics }),
      },
    ];
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    open([scan({ songId: 'a/b' })]);
    await screen.findByText('Santo');
    fireEvent.click(screen.getByRole('button', { name: /Excluir foto.jpg/ }));
    expect(confirm.mock.calls[0]?.[0]).toMatch(message);
  });
});
