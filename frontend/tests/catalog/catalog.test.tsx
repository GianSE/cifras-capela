import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  parseSitemap,
  resetCatalogForTests,
  searchCatalog,
  slugToTitle,
  type CatalogEntry,
} from '../../src/lib/catalog';
import { CifraSearch } from '../../src/components/import/CifraSearch';
import type { SongIndexEntry } from '../../src/types/library';

const urlset = (...urls: string[]) =>
  `<?xml version="1.0"?><urlset>${urls
    .map((u) => `<url>\n  <loc>${u}</loc>\n  <changefreq>weekly</changefreq>\n</url>`)
    .join('')}</urlset>`;

const MPM = urlset(
  'https://musicasparamissa.com.br/musica/segura-na-mao-de-deus/',
  'https://musicasparamissa.com.br/musica/a-alegria-esta-no-coracao/',
  'https://musicasparamissa.com.br/musicas-de/comunhao/',
  'https://musicasparamissa.com.br/sugestoes-para/vigilia-pascal-ano-b/',
);

const CC = urlset(
  'https://cifrascatolicas.com.br/rosa-de-saron',
  'https://cifrascatolicas.com.br/rosa-de-saron/segura-na-mao-de-deus',
  'https://cifrascatolicas.com.br/comunidade-católica-shalom/eterna-uniao',
);

const DECIFRANDO = urlset(
  'https://decifrando.app.br/musicas-catolicas/segura-na-mao-de-deus',
  'https://decifrando.app.br/musicas',
);

describe('parseSitemap', () => {
  it('no Músicas para Missa, pega só as músicas', () => {
    const entries = parseSitemap('musicas-para-missa', MPM);
    expect(entries.map((e) => e.title)).toEqual([
      'Segura na mao de deus',
      'A alegria esta no coracao',
    ]);
    expect(entries[0]?.url).toBe('https://musicasparamissa.com.br/musica/segura-na-mao-de-deus/');
  });

  it('no Cifras Católicas, tira o artista do endereço e ignora a página dele', () => {
    const entries = parseSitemap('cifras-catolicas', CC);
    expect(entries.map((e) => [e.title, e.artist])).toEqual([
      ['Segura na mao de deus', 'Rosa de saron'],
      ['Eterna uniao', 'Comunidade católica shalom'],
    ]);
  });

  it('endereço com acento fica pronto para ser buscado', () => {
    const [, entry] = parseSitemap('cifras-catolicas', CC);
    expect(entry?.url).toBe(
      'https://cifrascatolicas.com.br/comunidade-cat%C3%B3lica-shalom/eterna-uniao',
    );
    expect(entry?.words).toBe('eterna uniao comunidade catolica shalom');
  });

  it('não quebra com endereço inválido nem com arquivo que não é sitemap', () => {
    expect(parseSitemap('musicas-para-missa', urlset('nao-e-url'))).toEqual([]);
    expect(parseSitemap('musicas-para-missa', '<html>erro</html>')).toEqual([]);
  });

  it('no Decifrando, mesmo formato do Cifras Católicas: pega a música, ignora página de uma peça só', () => {
    const entries = parseSitemap('decifrando', DECIFRANDO);
    expect(entries.map((e) => [e.title, e.artist])).toEqual([
      ['Segura na mao de deus', 'Musicas catolicas'],
    ]);
  });
});

describe('slugToTitle', () => {
  it('troca hífens e põe maiúscula na primeira letra', () => {
    expect(slugToTitle('a-alegria')).toBe('A alegria');
    expect(slugToTitle('comunidade-cat%C3%B3lica')).toBe('Comunidade católica');
  });
});

describe('searchCatalog', () => {
  const entries: CatalogEntry[] = [
    ...parseSitemap('cifras-catolicas', CC),
    ...parseSitemap('musicas-para-missa', MPM),
  ];

  it('acha sem acento, sem maiúscula e pelo começo da palavra', () => {
    expect(searchCatalog(entries, 'SEGURA NA MÃO').length).toBe(2);
    expect(searchCatalog(entries, 'seg mao').length).toBe(2);
  });

  it('não acha pedaço no meio da palavra', () => {
    expect(searchCatalog(entries, 'gura')).toEqual([]);
  });

  it('procura também pelo artista', () => {
    expect(searchCatalog(entries, 'shalom').map((e) => e.title)).toEqual(['Eterna uniao']);
  });

  it('o título que começa pela busca vem antes, e o mais curto primeiro', () => {
    const [first] = searchCatalog(entries, 'segura');
    expect(first?.source).toBe('musicas-para-missa');
  });

  it('respeita o limite, e busca vazia não traz nada', () => {
    expect(searchCatalog(entries, 'segura', 1)).toHaveLength(1);
    expect(searchCatalog(entries, '   ')).toEqual([]);
  });
});

describe('CifraSearch', () => {
  const library: SongIndexEntry[] = [
    {
      id: 'final/segura-na-mao-de-deus',
      title: 'Segura na Mão de Deus',
      filename: 'x.cho',
      lyrics: 'se as águas do mar da vida',
    },
  ];

  /** Sites respondem conforme a URL pedida ao Worker. */
  function mockApi({ mpmFails = false } = {}) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/catalog/musicas-para-missa') {
        return mpmFails ? new Response('', { status: 502 }) : new Response(MPM);
      }
      if (url === '/api/catalog/cifras-catolicas') return new Response(CC);
      if (url === '/api/catalog/decifrando') return new Response(DECIFRANDO);
      if (url.startsWith('/api/catalog/cifraclub')) {
        // Como o site de verdade: só responde ao que conhece.
        if (!decodeURIComponent(url).includes('segura')) return Response.json({ results: [] });
        return Response.json({
          results: [
            {
              title: 'Segura Na Mão de Deus',
              artist: 'Músicas Católicas',
              url: 'https://www.cifraclub.com.br/catolicas/segura-na-mao-de-deus/',
            },
          ],
        });
      }
      throw new Error(`Inesperado: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const renderSearch = (onImport = vi.fn().mockResolvedValue(undefined)) => {
    render(
      <MemoryRouter>
        <CifraSearch songs={library} onImport={onImport} />
      </MemoryRouter>,
    );
    return { onImport, field: screen.getByRole('searchbox', { name: 'Procurar uma cifra' }) };
  };

  beforeEach(resetCatalogForTests);

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('não baixa o catálogo enquanto ninguém procura, nem com pouca letra', async () => {
    const fetchMock = mockApi();
    const { field } = renderSearch();
    fireEvent.change(field, { target: { value: 'se' } });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mostra biblioteca, sites e CifraClub, cada um com sua ação', async () => {
    mockApi();
    const { field, onImport } = renderSearch();
    fireEvent.change(field, { target: { value: 'segura na mão' } });

    const biblioteca = await screen.findByRole('region', { name: 'Já na sua biblioteca' });
    expect(biblioteca.querySelector('a')?.getAttribute('href')).toBe(
      '/musica/final/segura-na-mao-de-deus',
    );

    const sites = await screen.findByRole('region', { name: 'Trazer dos sites' });
    expect(sites.textContent).toContain('Músicas para Missa');
    expect(sites.textContent).toContain('Cifras Católicas');
    // Já tem uma com esse título: avisa antes de trazer outra.
    expect(sites.textContent).toContain('Pode já estar na biblioteca');

    const [trazer] = screen.getAllByRole('button', { name: /Trazer/ });
    fireEvent.click(trazer!);
    expect(onImport).toHaveBeenCalledWith(
      'https://musicasparamissa.com.br/musica/segura-na-mao-de-deus/',
    );

    const cifraclub = await screen.findByRole('region', { name: 'No CifraClub' });
    const link = cifraclub.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('href')).toContain('cifraclub.com.br/catolicas/');

    const trazerDoCifraClub = within(cifraclub).getByRole('button', { name: /Trazer/ });
    await waitFor(() => expect((trazerDoCifraClub as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(trazerDoCifraClub);
    expect(onImport).toHaveBeenLastCalledWith(
      'https://www.cifraclub.com.br/catolicas/segura-na-mao-de-deus/',
      { title: 'Segura Na Mão de Deus', artist: 'Músicas Católicas' },
    );
  });

  it('um site fora do ar não derruba os outros, e a tela avisa', async () => {
    mockApi({ mpmFails: true });
    const { field } = renderSearch();
    fireEvent.change(field, { target: { value: 'eterna uniao' } });

    const sites = await screen.findByRole('region', { name: 'Trazer dos sites' });
    expect(sites.textContent).toContain('Eterna uniao');
    expect(screen.getByText(/Sem resposta de Músicas para Missa/)).toBeTruthy();
  });

  it('diz quando não acha nada', async () => {
    mockApi();
    const { field } = renderSearch();
    fireEvent.change(field, { target: { value: 'palavra inexistente' } });
    await waitFor(() => expect(screen.getByText(/Nada encontrado/)).toBeTruthy());
  });

  it('as pílulas escolhem onde buscar — desmarcar um site some com o grupo dele e não pede a página', async () => {
    const fetchMock = mockApi();
    const { field } = renderSearch();

    fireEvent.click(screen.getByRole('button', { name: 'CifraClub' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cifras Católicas' }));
    fireEvent.change(field, { target: { value: 'segura na mão' } });

    const sites = await screen.findByRole('region', { name: 'Trazer dos sites' });
    expect(sites.textContent).toContain('Músicas para Missa');
    expect(sites.textContent).not.toContain('Cifras Católicas');
    expect(screen.queryByRole('region', { name: 'No CifraClub' })).toBeNull();

    await waitFor(() =>
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('cifraclub'), undefined),
    );
    expect(fetchMock).not.toHaveBeenCalledWith('/api/catalog/cifras-catolicas', undefined);
  });

  it('não deixa desmarcar o último site — sempre busca em algum', () => {
    mockApi();
    renderSearch();
    const pills = SITE_LABELS.map((label) => screen.getByRole('button', { name: label }));
    pills.forEach((pill) => fireEvent.click(pill));
    const last = pills[pills.length - 1]!;
    // O último continua marcado — a busca não ficou sem nenhum site.
    expect(last.getAttribute('aria-pressed')).toBe('true');
  });
});

const SITE_LABELS = ['CifraClub', 'Músicas para Missa', 'Cifras Católicas', 'Decifrando'];
