import { describe, it, expect, beforeEach } from 'vitest';
import { playlistStorage } from '../../src/lib/storage/playlists';
import {
  DEFAULT_MISSA_SECTIONS,
  formatMissaName,
  normalizePlaylist,
  parseMissaDate,
  sectionOf,
  suggestMissaDates,
} from '../../src/lib/missa';
import type { Playlist } from '../../src/types/playlist';

function missa(): string {
  return playlistStorage.create('Missa de domingo', [], 'missa');
}

function get(id: string): Playlist {
  return playlistStorage.get(id)!;
}

/** Id da parte pelo nome. */
function section(id: string, name: string): string {
  return get(id).sections!.find((s) => s.name === name)!.id;
}

describe('playlist do tipo missa', () => {
  beforeEach(() => {
    for (const p of [...playlistStorage.getSnapshot()]) playlistStorage.remove(p.id);
  });

  it('nasce com todas as partes da missa, na ordem e vazias', () => {
    const id = missa();
    const p = get(id);

    expect(p.kind).toBe('missa');
    expect(p.sections!.map((s) => s.name)).toEqual(DEFAULT_MISSA_SECTIONS);
    expect(p.sections!.every((s) => s.songIds.length === 0)).toBe(true);
    expect(p.songIds).toEqual([]);
  });

  it('a lista de músicas segue a ordem das partes, não a ordem em que foram escolhidas', () => {
    const id = missa();
    playlistStorage.addSong(id, 'santo-1', section(id, 'Santo'));
    playlistStorage.addSong(id, 'entrada-1', section(id, 'Entrada'));
    playlistStorage.addSong(id, 'final-1', section(id, 'Final'));

    expect(get(id).songIds).toEqual(['entrada-1', 'santo-1', 'final-1']);
    expect(sectionOf(get(id), 'santo-1')?.name).toBe('Santo');
  });

  it('sem parte indicada, a música vai para a primeira parte vazia', () => {
    const id = missa();
    playlistStorage.addSong(id, 'a');
    playlistStorage.addSong(id, 'b');
    expect(sectionOf(get(id), 'a')?.name).toBe('Ambientação');
    expect(sectionOf(get(id), 'b')?.name).toBe('Entrada');
  });

  it('não repete a mesma música em duas partes', () => {
    const id = missa();
    playlistStorage.addSong(id, 'a', section(id, 'Entrada'));
    playlistStorage.addSong(id, 'a', section(id, 'Final'));
    expect(get(id).songIds).toEqual(['a']);
    expect(sectionOf(get(id), 'a')?.name).toBe('Entrada');
  });

  it('remove a música da parte', () => {
    const id = missa();
    playlistStorage.addSong(id, 'a', section(id, 'Comunhão'));
    playlistStorage.removeSong(id, 'a');
    expect(get(id).songIds).toEqual([]);
    expect(sectionOf(get(id), 'a')).toBeUndefined();
  });

  it('reordena as músicas dentro de uma parte', () => {
    const id = missa();
    const comunhao = section(id, 'Comunhão');
    playlistStorage.addSong(id, 'a', comunhao);
    playlistStorage.addSong(id, 'b', comunhao);
    playlistStorage.reorderSection(id, comunhao, ['b', 'a']);
    expect(get(id).songIds).toEqual(['b', 'a']);
  });

  it('cria parte nova depois de outra (Pós-comunhão depois de Comunhão)', () => {
    const id = missa();
    playlistStorage.addSection(id, 'Pós-comunhão', section(id, 'Comunhão'));
    const names = get(id).sections!.map((s) => s.name);
    expect(names.slice(-3)).toEqual(['Comunhão', 'Pós-comunhão', 'Final']);
  });

  it('cria parte no começo e no fim', () => {
    const id = missa();
    playlistStorage.addSection(id, 'Abertura', null);
    playlistStorage.addSection(id, 'Amém');
    const names = get(id).sections!.map((s) => s.name);
    expect(names[0]).toBe('Abertura');
    expect(names.at(-1)).toBe('Amém');
  });

  it('renomeia, move e exclui partes', () => {
    const id = missa();
    const gloria = section(id, 'Glória');
    playlistStorage.addSong(id, 'g', gloria);

    playlistStorage.renameSection(id, gloria, 'Hino de louvor');
    expect(get(id).sections!.some((s) => s.name === 'Hino de louvor')).toBe(true);

    playlistStorage.renameSection(id, gloria, '   '); // vazio é ignorado
    expect(get(id).sections!.some((s) => s.name === 'Hino de louvor')).toBe(true);

    playlistStorage.moveSection(id, gloria, -1);
    expect(get(id).sections![2]!.id).toBe(gloria);

    playlistStorage.removeSection(id, gloria);
    expect(get(id).sections!.some((s) => s.id === gloria)).toBe(false);
    expect(get(id).songIds).toEqual([]); // a música da parte saiu junto
  });

  it('playlists comuns continuam iguais (sem partes)', () => {
    const id = playlistStorage.create('Culto', ['a']);
    expect(get(id).kind).toBeUndefined();
    expect(get(id).sections).toBeUndefined();
    playlistStorage.addSection(id, 'Entrada'); // não se aplica
    expect(get(id).sections).toBeUndefined();
  });

  it('normaliza a lista achatada a partir das partes', () => {
    const p = normalizePlaylist({
      id: 'x',
      name: 'Missa',
      kind: 'missa',
      songIds: ['lixo'],
      sections: [
        { id: 's1', name: 'Entrada', songIds: ['a'] },
        { id: 's2', name: 'Final', songIds: ['b'] },
      ],
      createdAt: '',
      updatedAt: '',
    });
    expect(p.songIds).toEqual(['a', 'b']);
  });
});

describe('data da missa', () => {
  /** Meio-dia local: o teste não depende do fuso de quem roda. */
  const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

  it('sugere o sábado e o domingo seguintes durante a semana', () => {
    expect(suggestMissaDates(on(2026, 11, 5))).toEqual({
      saturday: '2026-11-07',
      sunday: '2026-11-08',
    });
  });

  it('no sábado, sugere hoje e amanhã', () => {
    expect(suggestMissaDates(on(2026, 11, 7))).toEqual({
      saturday: '2026-11-07',
      sunday: '2026-11-08',
    });
  });

  it('no domingo, já sugere o fim de semana seguinte', () => {
    expect(suggestMissaDates(on(2026, 11, 8))).toEqual({
      saturday: '2026-11-14',
      sunday: '2026-11-15',
    });
  });

  it('vira o mês e o ano', () => {
    expect(suggestMissaDates(on(2026, 12, 31))).toEqual({
      saturday: '2027-01-02',
      sunday: '2027-01-03',
    });
  });

  it('usa a data local, sem pular de dia à noite', () => {
    // Quinta 23h30 no Brasil já é sexta em UTC: o resultado não pode mudar.
    expect(suggestMissaDates(new Date(2026, 10, 5, 23, 30)).sunday).toBe('2026-11-08');
  });

  it('o nome é a data por extenso, e dá para recuperar a data dele', () => {
    expect(formatMissaName('2026-11-08')).toBe('Domingo, 08/11/2026');
    expect(formatMissaName('2026-11-07')).toBe('Sábado, 07/11/2026');
    expect(parseMissaDate('Domingo, 08/11/2026')).toBe('2026-11-08');
  });

  it('nome livre (missas antigas) não tem data', () => {
    expect(parseMissaDate('Missa de domingo')).toBeUndefined();
  });

  it('aceita duas músicas na mesma parte, e as duas entram na fila de tocar', () => {
    const id = playlistStorage.create(formatMissaName('2026-11-08'), [], 'missa');
    const comunhao = playlistStorage.get(id)!.sections!.find((s) => s.name === 'Comunhão')!.id;
    playlistStorage.addSong(id, 'opcao-a', comunhao);
    playlistStorage.addSong(id, 'opcao-b', comunhao);

    const p = playlistStorage.get(id)!;
    expect(p.name).toBe('Domingo, 08/11/2026');
    expect(p.sections!.find((s) => s.id === comunhao)!.songIds).toEqual(['opcao-a', 'opcao-b']);
    expect(p.songIds).toEqual(['opcao-a', 'opcao-b']);
    playlistStorage.remove(id);
  });
});
