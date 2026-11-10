import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { partKey, songsForPart, withPartCategory } from '../../src/lib/missa';
import { resetCatalogForTests } from '../../src/lib/catalog';
import { playlistStorage } from '../../src/lib/storage/playlists';
import { SongPicker } from '../../src/components/playlist/SongPicker';
import type { SongIndexEntry } from '../../src/types/library';
import type { Playlist } from '../../src/types/playlist';

const song = (id: string, title: string, categories?: string[]): SongIndexEntry => ({
  id,
  title,
  filename: 'x.cho',
  ...(categories && { categories }),
});

describe('a parte da missa como tag', () => {
  it('nomes diferentes da mesma parte dão na mesma', () => {
    expect(partKey('Ofertório')).toBe(partKey('Oferendas'));
    expect(partKey('Hino de Louvor')).toBe(partKey('Glória'));
    expect(partKey('Comunhão (2ª)')).toBe(partKey('comunhao'));
    expect(partKey('Aclamação ao Evangelho')).toBe(partKey('Aclamação'));
    expect(partKey('Pai-Nosso')).toBe(partKey('pai nosso'));
  });

  it('partes diferentes não se confundem', () => {
    expect(partKey('Pós-comunhão')).not.toBe(partKey('Comunhão'));
    expect(partKey('Santo')).not.toBe(partKey('Santa Missa'));
    expect(partKey('Abraço da paz')).toBe('abraco da paz');
  });

  it('acrescenta a parte às categorias, se ainda não estiver lá', () => {
    expect(withPartCategory(undefined, 'Comunhão')).toEqual(['Comunhão']);
    expect(withPartCategory(['Natal'], 'Comunhão')).toEqual(['Natal', 'Comunhão']);
    expect(withPartCategory(['comunhao'], 'Comunhão')).toEqual(['comunhao']);
    expect(withPartCategory(['Oferendas'], 'Ofertório')).toEqual(['Oferendas']);
  });

  const missa = (id: string, part: string, songIds: string[]): Playlist => ({
    id,
    name: id,
    kind: 'missa',
    songIds,
    sections: [{ id: 's', name: part, songIds }],
    createdAt: '',
    updatedAt: '',
  });

  it('acha pela categoria e pelo que já foi usado, o mais usado primeiro', () => {
    const songs = [
      song('a', 'Alfa', ['Comunhão']),
      song('b', 'Beta'),
      song('c', 'Gama'),
      song('d', 'Delta', ['Final']),
    ];
    const used = [missa('m1', 'Comunhão', ['b', 'c']), missa('m2', 'Comunhão (2ª)', ['c'])];
    expect(songsForPart(songs, used, 'Comunhão').map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('a própria missa não conta como uso anterior', () => {
    const songs = [song('b', 'Beta')];
    expect(songsForPart(songs, [missa('m1', 'Comunhão', ['b'])], 'Comunhão', 'm1')).toEqual([]);
  });

  it('playlist comum não sugere nada', () => {
    const lista: Playlist = {
      id: 'l',
      name: 'l',
      songIds: ['b'],
      createdAt: '',
      updatedAt: '',
    };
    expect(songsForPart([song('b', 'Beta')], [lista], 'Comunhão')).toEqual([]);
  });
});

let isAdmin = true;
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ isAdmin }),
}));

function Where() {
  const location = useLocation();
  return <p data-testid="onde">{`${location.pathname}${location.search}`}</p>;
}

describe('Escolher música', () => {
  const LIBRARY = [
    song('comunhao/pao', 'Pão da Vida', ['Comunhão']),
    song('final/vamos', 'Vamos Embora', ['Final']),
  ];
  let missaId: string;
  let comunhao: NonNullable<Playlist['sections']>[number];
  const onPick = vi.fn();
  const onClose = vi.fn();

  function open(songs = LIBRARY, withSection = true) {
    render(
      <MemoryRouter initialEntries={['/playlists/x']}>
        <Routes>
          <Route
            path="/playlists/x"
            element={
              <SongPicker
                playlist={playlistStorage.get(missaId)!}
                section={withSection ? comunhao : undefined}
                open
                songs={songs}
                onPick={onPick}
                onClose={onClose}
              />
            }
          />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const field = () => screen.getByRole('searchbox', { name: 'Procurar música' });

  beforeEach(() => {
    isAdmin = true;
    onPick.mockClear();
    onClose.mockClear();
    resetCatalogForTests();
    for (const p of [...playlistStorage.getSnapshot()]) playlistStorage.remove(p.id);
    missaId = playlistStorage.create('Domingo, 08/11/2026', [], 'missa');
    comunhao = playlistStorage.get(missaId)!.sections!.find((s) => s.name === 'Comunhão')!;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/catalog/musicas-para-missa') {
          return new Response(
            '<urlset><url><loc>https://musicasparamissa.com.br/musica/vinde-todos/</loc></url></urlset>',
          );
        }
        if (url.startsWith('/api/catalog/cifraclub')) {
          return Response.json({
            results: [
              { title: 'Vinde Todos', artist: 'Coral', url: 'https://www.cifraclub.com.br/c/v/' },
            ],
          });
        }
        if (url.startsWith('/api/catalog/')) return new Response('<urlset></urlset>');
        if (url === '/api/scans') {
          return Response.json({
            scan: { id: 'fl_novo', filename: 'foto.jpg', contentType: 'image/jpeg', songId: null },
          });
        }
        return Response.json({ ok: true });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('o que combina com a parte vem primeiro, separado do resto', () => {
    open();
    const parte = screen.getByRole('region', { name: 'Já usadas em Comunhão' });
    expect(within(parte).getByRole('button', { name: /Pão da Vida/ })).toBeTruthy();
    const resto = screen.getByRole('region', { name: 'Na biblioteca' });
    expect(within(resto).getByRole('button', { name: /Vamos Embora/ })).toBeTruthy();
  });

  it('tocar numa música da biblioteca escolhe', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /Pão da Vida/ }));
    expect(onPick).toHaveBeenCalledWith('comunhao/pao');
  });

  it('filtra sem acento nem maiúscula', () => {
    open();
    fireEvent.change(field(), { target: { value: 'PAO' } });
    expect(screen.getByRole('button', { name: /Pão da Vida/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Vamos Embora/ })).toBeNull();
  });

  it('digitar o nome procura nos sites, e Trazer leva à revisão com a parte', async () => {
    open();
    fireEvent.change(field(), { target: { value: 'vinde todos' } });

    const sites = await screen.findByRole('region', { name: 'Trazer dos sites' });
    expect(sites.textContent).toContain('Músicas para Missa');
    expect(await screen.findByRole('region', { name: 'No CifraClub' })).toBeTruthy();

    fireEvent.click(within(sites).getByRole('button', { name: /Trazer/ }));
    const target = new URL(screen.getByTestId('onde').textContent!, 'http://x');
    expect(target.pathname).toBe('/importar');
    expect(target.searchParams.get('url')).toBe(
      'https://musicasparamissa.com.br/musica/vinde-todos/',
    );
    expect(target.searchParams.get('missa')).toBe(missaId);
    expect(target.searchParams.get('parte')).toBe(comunhao.id);
  });

  it('colar um link oferece trazer daquela página, sem procurar nos sites', () => {
    open();
    const url = 'https://www.cifraclub.com.br/catolicas/santo/';
    fireEvent.change(field(), { target: { value: url } });
    fireEvent.click(screen.getByRole('button', { name: 'Trazer desta página' }));

    const target = new URL(screen.getByTestId('onde').textContent!, 'http://x');
    expect(target.searchParams.get('url')).toBe(url);
    expect(target.searchParams.get('parte')).toBe(comunhao.id);
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/catalog/'),
      expect.anything(),
    );
  });

  it('Importar música leva para o importador, com a missa e a parte', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Importar música' }));
    const target = new URL(screen.getByTestId('onde').textContent!, 'http://x');
    expect(target.pathname).toBe('/importar');
    expect(target.searchParams.get('missa')).toBe(missaId);
    expect(target.searchParams.get('parte')).toBe(comunhao.id);
    expect(target.searchParams.has('url')).toBe(false);
  });

  it('numa playlist comum também funciona, sem parte nem categoria', async () => {
    missaId = playlistStorage.create('Ensaio', []);
    comunhao = undefined as never;
    open(LIBRARY, false);
    expect(screen.queryByRole('region', { name: /Já usadas/ })).toBeNull();
    expect(screen.getByText(/Não tem\?/).textContent).not.toContain(': ela já entra');

    fireEvent.change(field(), { target: { value: 'https://site.com/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trazer desta página' }));
    const target = new URL(screen.getByTestId('onde').textContent!, 'http://x');
    expect(target.searchParams.get('missa')).toBe(missaId);
    expect(target.searchParams.has('parte')).toBe(false);
  });

  it('quem só lê escolhe da biblioteca, sem importar nem busca nos sites', async () => {
    isAdmin = false;
    open();
    expect(screen.queryByRole('button', { name: /Importar música/ })).toBeNull();
    fireEvent.change(field(), { target: { value: 'vinde todos' } });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Nenhuma música disponível.')).toBeTruthy();
  });
});
