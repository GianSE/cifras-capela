import { describe, it, expect, beforeEach } from 'vitest';
import { playlistStorage } from '../../src/lib/storage/playlists';

/** Cria uma playlist limpa e devolve seu id. */
function fresh(songs: string[] = []): string {
  return playlistStorage.create('Culto de domingo', songs);
}

describe('playlistStorage', () => {
  beforeEach(() => {
    // Remove tudo que sobrou de testes anteriores (store é singleton).
    for (const p of [...playlistStorage.getSnapshot()]) playlistStorage.remove(p.id);
  });

  it('cria uma playlist com nome e músicas', () => {
    const id = fresh(['a', 'b']);
    const playlist = playlistStorage.get(id);

    expect(playlist?.name).toBe('Culto de domingo');
    expect(playlist?.songIds).toEqual(['a', 'b']);
    expect(playlistStorage.getSnapshot()).toHaveLength(1);
  });

  it('usa um nome padrão quando vazio', () => {
    const id = playlistStorage.create('   ');
    expect(playlistStorage.get(id)?.name).toBe('Nova playlist');
  });

  it('adiciona no fim e ignora duplicatas', () => {
    const id = fresh(['a']);
    playlistStorage.addSong(id, 'b');
    playlistStorage.addSong(id, 'a'); // duplicata
    expect(playlistStorage.get(id)?.songIds).toEqual(['a', 'b']);
  });

  it('remove música', () => {
    const id = fresh(['a', 'b', 'c']);
    playlistStorage.removeSong(id, 'b');
    expect(playlistStorage.get(id)?.songIds).toEqual(['a', 'c']);
  });

  it('reordena substituindo a ordem inteira (arrastar-e-soltar)', () => {
    const id = fresh(['a', 'b', 'c']);
    playlistStorage.reorder(id, ['c', 'a', 'b']);
    expect(playlistStorage.get(id)?.songIds).toEqual(['c', 'a', 'b']);
  });

  it('move preservando as demais músicas', () => {
    const id = fresh(['a', 'b', 'c', 'd']);

    playlistStorage.move(id, 0, 2); // 'a' para a 3ª posição
    expect(playlistStorage.get(id)?.songIds).toEqual(['b', 'c', 'a', 'd']);

    playlistStorage.move(id, 3, 0); // 'd' para o começo
    expect(playlistStorage.get(id)?.songIds).toEqual(['d', 'b', 'c', 'a']);
  });

  it('move com índice inválido não altera nada', () => {
    const id = fresh(['a', 'b']);
    playlistStorage.move(id, 9, 0);
    expect(playlistStorage.get(id)?.songIds).toEqual(['a', 'b']);
  });

  it('renomeia e mantém a ordem', () => {
    const id = fresh(['a', 'b']);
    playlistStorage.rename(id, 'Ensaio de sábado');
    expect(playlistStorage.get(id)?.name).toBe('Ensaio de sábado');
    expect(playlistStorage.get(id)?.songIds).toEqual(['a', 'b']);
  });

  it('ignora renomear para vazio', () => {
    const id = fresh();
    playlistStorage.rename(id, '   ');
    expect(playlistStorage.get(id)?.name).toBe('Culto de domingo');
  });

  it('exclui a playlist', () => {
    const id = fresh();
    playlistStorage.remove(id);
    expect(playlistStorage.get(id)).toBeUndefined();
  });

  it('atualiza updatedAt ao modificar', async () => {
    const id = fresh(['a']);
    const before = playlistStorage.get(id)!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    playlistStorage.addSong(id, 'b');
    expect(playlistStorage.get(id)!.updatedAt >= before).toBe(true);
  });

  it('persiste no localStorage', () => {
    const id = fresh(['a', 'b']);
    const raw = localStorage.getItem('cifras-capela:playlists');
    expect(raw).toContain(id);
    expect(raw).toContain('Culto de domingo');
  });

  it('notifica os assinantes ao mudar', () => {
    let calls = 0;
    const unsubscribe = playlistStorage.subscribe(() => calls++);

    const id = fresh();
    playlistStorage.addSong(id, 'a');
    playlistStorage.reorder(id, ['a']);

    unsubscribe();
    playlistStorage.addSong(id, 'b'); // não deve mais notificar

    expect(calls).toBe(3);
  });

  it('operações não mutam o snapshot anterior (imutabilidade)', () => {
    const id = fresh(['a']);
    const snapshot = playlistStorage.getSnapshot();
    const playlistBefore = snapshot.find((p) => p.id === id)!;

    playlistStorage.addSong(id, 'b');

    expect(playlistBefore.songIds).toEqual(['a']);
    expect(playlistStorage.getSnapshot()).not.toBe(snapshot);
  });
});
