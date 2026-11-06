import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { findDuplicates, normalizeTitle } from '../../src/lib/library/duplicates';
import { DuplicateWarning } from '../../src/components/library/DuplicateWarning';
import { EditorPage } from '../../src/pages/EditorPage';
import { songService } from '../../src/services/song-service';
import type { SongIndexEntry } from '../../src/types/library';

const LETRA = `Se as águas do mar da vida quiserem te afogar segura na mão de Deus e vai
se as tristezas desta vida quiserem te sufocar segura na mão de Deus e vai
segura na mão de Deus segura na mão de Deus pois ela te sustentará
não temas segue adiante e não olhes para trás`;

function song(id: string, title: string, lyrics?: string, artist?: string): SongIndexEntry {
  return {
    id,
    title,
    filename: 'x.cho',
    ...(lyrics && { lyrics }),
    ...(artist && { artist }),
  };
}

vi.mock('../../src/hooks/useSongLibrary', () => ({
  useSongLibrary: () => ({
    songs: [song('culto/nova-musica', 'Nova Música')],
    isLoading: false,
  }),
}));

vi.mock('../../src/components/auth/RequireAuth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

describe('normalizeTitle', () => {
  it('ignora acento, caixa, pontuação e o que varia entre sites', () => {
    const esperado = 'segura na mao de deus';
    expect(normalizeTitle('Segura na Mão de Deus!')).toBe(esperado);
    expect(normalizeTitle('SEGURA NA MÃO DE DEUS (Ao vivo)')).toBe(esperado);
    expect(normalizeTitle('Segura na mão de Deus - Pe. Zezinho')).toBe(esperado);
  });

  it('não confunde hífen dentro da palavra com o do intérprete', () => {
    expect(normalizeTitle('Pós-comunhão')).toBe('pos comunhao');
  });
});

describe('findDuplicates', () => {
  it('acha o mesmo título em outra categoria, que o id não pegaria', () => {
    const [match, ...rest] = findDuplicates({ title: 'Segura na Mão de Deus' }, [
      song('comunhao/segura-na-mao-de-deus', 'SEGURA NA MÃO DE DEUS'),
      song('final/outra', 'Outra música'),
    ]);
    expect(match?.song.id).toBe('comunhao/segura-na-mao-de-deus');
    expect(match?.sameTitle).toBe(true);
    expect(rest).toEqual([]);
  });

  it('acha a mesma letra com outro título, mesmo com um verso a mais', () => {
    const [match] = findDuplicates({ title: 'Mão de Deus', lyrics: LETRA }, [
      song('a/b', 'Segura', `${LETRA} eu vou seguindo com fé neste caminho até o fim`),
    ]);
    expect(match?.similarLyrics).toBe(true);
    expect(match?.sameTitle).toBe(false);
  });

  it('não acusa letras diferentes que só dividem palavras comuns', () => {
    const outra = `O Senhor é meu pastor e nada me faltará em verdes prados ele me faz
    repousar e conduz minha alma às águas tranquilas por amor do seu nome de Deus`;
    expect(findDuplicates({ title: 'Salmo', lyrics: LETRA }, [song('a/b', 'x', outra)])).toEqual(
      [],
    );
  });

  it('letra curta demais não permite concluir nada', () => {
    const curta = 'Santo santo santo Senhor';
    expect(findDuplicates({ title: 'A', lyrics: curta }, [song('a/b', 'B', curta)])).toEqual([]);
  });

  it('título vazio não casa com música sem título', () => {
    expect(findDuplicates({ title: '  ' }, [song('a/b', '')])).toEqual([]);
  });

  it('o sinal mais forte vem primeiro', () => {
    const matches = findDuplicates({ title: 'Santo', lyrics: LETRA }, [
      song('so/titulo', 'Santo'),
      song('so/letra', 'Outro nome', LETRA),
      song('os/dois', 'Santo', LETRA),
    ]);
    expect(matches.map((m) => m.song.id)).toEqual(['os/dois', 'so/letra', 'so/titulo']);
  });
});

describe('DuplicateWarning', () => {
  const show = (title: string, songs: SongIndexEntry[]) =>
    render(
      <MemoryRouter>
        <DuplicateWarning title={title} songs={songs} />
      </MemoryRouter>,
    );

  it('não mostra nada quando a música é nova', () => {
    const { container } = show('Inédita', [song('a/b', 'Outra')]);
    expect(container.textContent).toBe('');
  });

  it('mostra a parecida com link em outra aba, sem apagar o que foi digitado', () => {
    show('Amém', [song('final/amem', 'Amém', undefined, 'Pe. Zezinho')]);
    expect(screen.getByRole('status').textContent).toContain('Pe. Zezinho');
    expect(screen.getByRole('status').textContent).toContain('mesmo título');
    const link = screen.getByRole('link', { name: /Amém/ });
    expect(link.getAttribute('href')).toBe('/musica/final/amem');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('resume quando há muitas parecidas', () => {
    show(
      'Santo',
      ['a', 'b', 'c', 'd', 'e'].map((x) => song(`s/${x}`, 'Santo')),
    );
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByText('E mais 2 parecidas.')).toBeTruthy();
  });
});

describe('salvar música nova no Editor', () => {
  // O modelo do Editor se chama "Nova Música", na categoria culto: o mesmo id
  // da música que está na biblioteca simulada acima.
  let save: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    save = vi.spyOn(songService, 'saveSong').mockResolvedValue(undefined as never);
    Object.defineProperty(songService, 'canWrite', { configurable: true, get: () => true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderEditor = () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <EditorPage />
      </MemoryRouter>,
    );
    return screen.getByRole('button', { name: /Salvar/ });
  };

  it('avisa que a música pode já existir', () => {
    renderEditor();
    expect(screen.getByRole('status').textContent).toContain('Nova Música');
  });

  it('com id repetido, guarda como nova em vez de apagar a antiga', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(renderEditor());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]?.[0]).toMatchObject({ id: 'culto/nova-musica-2' });
  });

  it('cancelando, não grava nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(renderEditor());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(save).not.toHaveBeenCalled();
  });
});
