import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import {
  daysForDate,
  parseDaysFromSitemap,
  parseSuggestionsPage,
  resetSuggestionsForTests,
  searchDays,
  suggestionsForSection,
  type LiturgicalCalendar,
  type SuggestionGroup,
} from '../../src/lib/missa-suggestions';
import { playlistStorage } from '../../src/lib/storage/playlists';
import { formatMissaName } from '../../src/lib/missa';
import { PlaylistPage } from '../../src/pages/PlaylistPage';
import type { SongIndexEntry } from '../../src/types/library';

/** A mesma estrutura de uma página real do site, com música inventada. */
const PAGE = `<html><body>
<h2 class="page-title">32º Domingo do Tempo Comum - Ano A</h2>
<div class="panel-group accordion nav-side sugestoes-para" id="accorside1">
  <div class="panel accordion-group">
    <div class="accordion-heading accordion-collapse-in">
      <a class="accordion-toggle" href="#a1"><i class="fa fa-font"></i> Antífona de Entrada </a>
    </div>
    <div id="a1" class="accordion-body collapse"><div class="text-content">Texto da antífona</div></div>
    <div class="accordion-heading accordion-collapse-in">
      <a class="accordion-toggle" href="#a2"><i class="fa fa-microphone"></i> Canto de Abertura - Sugestões de Músicas </a>
    </div>
    <div id="a2" class="accordion-body collapse">
      <ul class="list-unstyled">
        <li><a href="/musica/nossa-louvacao/" target="_blank"> NOSSA LOUVAÇÃO - (Comunidade Teste) </a>
          <div class="star-ratings"><a href="#1"></a></div></li>
        <li><a href="/musica/vinde-todos/" target="_blank"> VINDE TODOS </a></li>
      </ul>
      <div class="sugestoes-para__links"><a href="/musicas-de/entrada-generica/">Mais</a></div>
    </div>
    <div class="accordion-heading accordion-collapse-in">
      <a class="accordion-toggle" href="#a3"><i class="fa fa-microphone"></i> Salmo Responsorial 62: A minh'alma tem sede - Sugestões de Melodia: </a>
    </div>
    <div id="a3" class="accordion-body collapse">
      <ul><li><a href="/musica/salmo-62/">SALMO 62</a></li></ul>
    </div>
    <div class="accordion-heading"><a class="accordion-toggle" href="#a4"><i class="fa fa-font"></i> Evangelho (Mt 25,1-13)</a></div>
    <div id="a4" class="accordion-body collapse"><p>Texto <a href="/musica/nao-e-sugestao/">link solto</a></p></div>
    <div class="accordion-heading"><a class="accordion-toggle" href="#a5"><i class="fa fa-microphone"></i> Comunhão - Sugestões de Músicas</a></div>
    <div id="a5" class="accordion-body collapse">
      <ul><li><a href="/musica/pao-da-vida/">PÃO DA VIDA</a></li></ul>
    </div>
  </div>
</div>
<div class="proximas-semanas"><a href="/musica/fora-das-sugestoes/">Outra coisa</a></div>
</body></html>`;

const parsePage = () => parseSuggestionsPage(new DOMParser().parseFromString(PAGE, 'text/html'));

const CALENDAR: LiturgicalCalendar = {
  '07/11/2026': {
    title: 'Sábado da 31ª Semana do Tempo Comum  ',
    url: '/sugestoes-para/sabado-da-31a-semana-do-tempo-comum-par',
  },
  '08/11/2026': {
    title: '32º Domingo do Tempo Comum - Ano A',
    url: '/sugestoes-para/32o-domingo-do-tempo-comum-ano-a',
  },
  '10/11/2026': { title: 'Sem endereço válido', url: 'https://outro.site/x' },
};

describe('parseSuggestionsPage', () => {
  it('lê só as partes com música, com título e endereço completo', () => {
    const groups = parsePage();
    expect(groups.map((g) => g.heading)).toEqual([
      'Canto de Abertura',
      "Salmo Responsorial 62: A minh'alma tem sede",
      'Comunhão',
    ]);
    expect(groups[0]?.songs).toEqual([
      {
        title: 'NOSSA LOUVAÇÃO - (Comunidade Teste)',
        url: 'https://musicasparamissa.com.br/musica/nossa-louvacao/',
      },
      { title: 'VINDE TODOS', url: 'https://musicasparamissa.com.br/musica/vinde-todos/' },
    ]);
    expect(groups[0]?.moreUrl).toBe('https://musicasparamissa.com.br/musicas-de/entrada-generica/');
  });

  it('página sem sugestões não quebra', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body>Fora do ar</body></html>',
      'text/html',
    );
    expect(parseSuggestionsPage(doc)).toEqual([]);
  });
});

describe('suggestionsForSection', () => {
  const group = (heading: string): SuggestionGroup => ({
    heading,
    songs: [{ title: 'x', url: 'y' }],
  });
  const ALL = [
    'Canto de Abertura',
    'Ato Penitencial',
    'Hino de Louvor',
    'Refrão Orante',
    'Salmo Responsorial 62 (63): Tenho sede',
    'Aclamação ao Evangelho',
    'Apresentação das Oferendas',
    'Santo',
    'Oração Eucarística',
    'Doxologia Amém',
    'Pai Nosso',
    'Cordeiro',
    'Comunhão',
    'Final',
  ].map(group);

  const headingFor = (name: string) => suggestionsForSection(ALL, name)?.heading;

  it('liga cada parte padrão da missa à parte certa do site', () => {
    expect(
      [
        'Ambientação',
        'Entrada',
        'Ato penitencial',
        'Glória',
        'Salmo',
        'Aclamação ao Evangelho',
        'Ofertório',
        'Santo',
        'Cordeiro',
        'Comunhão',
        'Final',
      ].map(headingFor),
    ).toEqual([
      'Refrão Orante',
      'Canto de Abertura',
      'Ato Penitencial',
      'Hino de Louvor',
      'Salmo Responsorial 62 (63): Tenho sede',
      'Aclamação ao Evangelho',
      'Apresentação das Oferendas',
      'Santo',
      'Cordeiro',
      'Comunhão',
      'Final',
    ]);
  });

  it('funciona com as partes criadas e renomeadas à mão', () => {
    expect(headingFor('Amém')).toBe('Doxologia Amém');
    expect(headingFor('Pai-Nosso')).toBe('Pai Nosso');
    expect(headingFor('Comunhão (2ª)')).toBe('Comunhão');
    expect(headingFor('Hino de louvor')).toBe('Hino de Louvor');
  });

  it('no Advento, a Entrada é o canto de abertura, e não a da vela', () => {
    const advento = [group('Entrada da Vela - Coroa do Advento'), group('Canto de Abertura')];
    expect(suggestionsForSection(advento, 'Entrada')?.heading).toBe('Canto de Abertura');
    expect(suggestionsForSection(advento, 'Coroa do Advento')?.heading).toBe(
      'Entrada da Vela - Coroa do Advento',
    );
  });

  it('sem Glória no dia (Advento, Quaresma), a parte fica sem sugestões', () => {
    expect(suggestionsForSection([group('Santo')], 'Glória')).toBeUndefined();
  });

  it('outro título com a palavra santo não vira a parte do Santo', () => {
    expect(suggestionsForSection([group('Sequência do Espírito Santo')], 'Santo')).toBeUndefined();
  });

  it('parte sem correspondência não recebe a sugestão de outra', () => {
    expect(headingFor('Pós-comunhão')).toBeUndefined();
    expect(headingFor('Abraço da paz')).toBeUndefined();
  });
});

describe('daysForDate', () => {
  it('no domingo, é o próprio dia', () => {
    expect(daysForDate(CALENDAR, '2026-11-08')).toEqual([
      { slug: '32o-domingo-do-tempo-comum-ano-a', title: '32º Domingo do Tempo Comum - Ano A' },
    ]);
  });

  it('no sábado, oferece primeiro o domingo seguinte e depois o sábado', () => {
    expect(daysForDate(CALENDAR, '2026-11-07').map((d) => d.slug)).toEqual([
      '32o-domingo-do-tempo-comum-ano-a',
      'sabado-da-31a-semana-do-tempo-comum-par',
    ]);
  });

  it('fora do calendário, ou com endereço estranho, não há dia', () => {
    expect(daysForDate(CALENDAR, '2027-06-06')).toEqual([]);
    expect(daysForDate(CALENDAR, '2026-11-10')).toEqual([]);
    expect(daysForDate(CALENDAR, 'qualquer')).toEqual([]);
  });
});

describe('escolher o dia pelo nome', () => {
  const xml = `<urlset>
    <url><loc>https://musicasparamissa.com.br/sugestoes-para/32o-domingo-do-tempo-comum-ano-a/</loc></url>
    <url><loc>https://musicasparamissa.com.br/sugestoes-para/vigilia-pascal-ano-b/</loc></url>
    <url><loc>https://musicasparamissa.com.br/musica/santo/</loc></url>
  </urlset>`;

  it('tira os dias do sitemap, sem as músicas', () => {
    const days = parseDaysFromSitemap(xml);
    expect(days.map((d) => d.slug)).toEqual([
      '32o-domingo-do-tempo-comum-ano-a',
      'vigilia-pascal-ano-b',
    ]);
    expect(days[1]?.title).toBe('Vigilia pascal ano b');
    expect(days[0]?.title).toBe('32º domingo do tempo comum ano a');
  });

  it('acha pelas palavras do nome', () => {
    const days = parseDaysFromSitemap(xml);
    expect(searchDays(days, 'vigília').map((d) => d.slug)).toEqual(['vigilia-pascal-ano-b']);
    expect(searchDays(days, 'domingo comum').map((d) => d.slug)).toEqual([
      '32o-domingo-do-tempo-comum-ano-a',
    ]);
    expect(searchDays(days, '  ')).toEqual([]);
  });
});

// ── A tela inteira ───────────────────────────────────────────────────────────

let isAdmin = true;
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ isAdmin, user: null, isSignedIn: true, isLoading: false }),
}));

const LIBRARY: SongIndexEntry[] = [
  { id: 'entrada/vinde-todos', title: 'Vinde Todos', filename: 'x.cho', artist: 'Coral' },
];

vi.mock('../../src/hooks/useLibrary', () => ({
  useLibrary: () => ({ songs: LIBRARY, isLoading: false }),
}));

/** Mostra para onde a tela navegou. */
function Where() {
  const location = useLocation();
  return <p data-testid="onde">{`${location.pathname}${location.search}`}</p>;
}

function renderMissa(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/playlists/${id}`]}>
      <Routes>
        <Route path="/playlists/:id" element={<PlaylistPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('sugestões na tela da missa', () => {
  function mockApi({ failing = false } = {}) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (failing) return new Response('', { status: 502 });
      if (url === '/api/catalog/sugestoes/datas') return Response.json(CALENDAR);
      if (url.startsWith('/api/catalog/sugestoes/')) return new Response(PAGE);
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  beforeEach(() => {
    isAdmin = true;
    localStorage.clear();
    resetSuggestionsForTests();
    for (const p of [...playlistStorage.getSnapshot()]) playlistStorage.remove(p.id);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const createMissa = () => playlistStorage.create(formatMissaName('2026-11-08'), [], 'missa');
  const part = (name: string) => screen.getByRole('region', { name });

  it('acha o dia pela data e oferece as sugestões em cada parte', async () => {
    mockApi();
    renderMissa(createMissa());

    expect(await screen.findByText('32º Domingo do Tempo Comum - Ano A')).toBeTruthy();
    await within(part('Entrada')).findByRole('button', { name: /2 sugestões do dia/ });
    expect(
      within(part('Comunhão')).getByRole('button', { name: /1 sugestão do dia/ }),
    ).toBeTruthy();
    // O Santo não veio na página: sem botão, em vez de um botão vazio.
    expect(within(part('Santo')).queryByRole('button', { name: /sugest/ })).toBeNull();
  });

  it('o que está na biblioteca entra direto na parte certa', async () => {
    mockApi();
    const id = createMissa();
    renderMissa(id);

    fireEvent.click(
      await within(part('Entrada')).findByRole('button', { name: /sugestões do dia/ }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Na biblioteca: Vinde Todos · Coral');
    expect(dialog.textContent).toContain('32º Domingo do Tempo Comum - Ano A');

    fireEvent.click(within(dialog).getByRole('button', { name: /Usar/ }));

    const missa = playlistStorage.get(id)!;
    expect(missa.sections!.find((s) => s.name === 'Entrada')!.songIds).toEqual([
      'entrada/vinde-todos',
    ]);
  });

  it('o resto vai para a revisão, levando a missa e a parte', async () => {
    mockApi();
    const id = createMissa();
    renderMissa(id);

    fireEvent.click(
      await within(part('Comunhão')).findByRole('button', { name: /sugestão do dia/ }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Usar/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: /Trazer/ }));

    const comunhao = playlistStorage.get(id)!.sections!.find((s) => s.name === 'Comunhão')!;
    const target = new URL(screen.getByTestId('onde').textContent!, 'http://x');
    expect(target.pathname).toBe('/importar');
    expect(target.searchParams.get('url')).toBe(
      'https://musicasparamissa.com.br/musica/pao-da-vida/',
    );
    expect(target.searchParams.get('missa')).toBe(id);
    expect(target.searchParams.get('parte')).toBe(comunhao.id);
  });

  it('a música que já está na missa não é oferecida de novo', async () => {
    mockApi();
    const id = createMissa();
    playlistStorage.addSong(id, 'entrada/vinde-todos');
    renderMissa(id);

    fireEvent.click(
      await within(part('Entrada')).findByRole('button', { name: /sugestões do dia/ }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Na missa');
    expect(within(dialog).queryByRole('button', { name: /Usar/ })).toBeNull();
  });

  it('no salmo, o diálogo diz qual é o salmo do dia', async () => {
    mockApi();
    renderMissa(createMissa());
    fireEvent.click(await within(part('Salmo')).findByRole('button', { name: /do dia/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain("Salmo Responsorial 62: A minh'alma tem sede");
  });

  it('com o site fora do ar, a missa continua funcionando, sem sugestões', async () => {
    const fetchMock = mockApi({ failing: true });
    renderMissa(createMissa());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Procurando as sugestões/)).toBeNull());
    expect(within(part('Entrada')).getByRole('button', { name: /Escolher música/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /sugest/ })).toBeNull();
  });

  it('data fora do calendário pede para escolher o dia', async () => {
    mockApi();
    renderMissa(playlistStorage.create(formatMissaName('2027-06-06'), [], 'missa'));
    expect(await screen.findByText(/não está no calendário do site/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher dia' })).toBeTruthy();
  });

  it('quem só lê não vê sugestões nem busca nada no site', async () => {
    isAdmin = false;
    const fetchMock = mockApi();
    renderMissa(createMissa());

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Sugestões para/)).toBeNull();
    expect(screen.queryByText(/Procurando as sugestões/)).toBeNull();
  });
});
