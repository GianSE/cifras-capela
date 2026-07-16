import { describe, it, expect, beforeEach } from 'vitest';
import { preferencesStorage } from '../../src/lib/storage/preferences';

/**
 * O tom em que cada música foi deixada é salvo por música, para a cifra
 * reabrir exatamente como você parou.
 */
describe('preferencesStorage — tons salvos por música', () => {
  beforeEach(() => {
    preferencesStorage.clearTranspositions();
  });

  it('retorna 0 para uma música nunca transposta', () => {
    expect(preferencesStorage.getTransposition('harpa/porque-ele-vive')).toBe(0);
  });

  it('salva e restaura o tom de uma música', () => {
    preferencesStorage.setTransposition('harpa/porque-ele-vive', 3);
    expect(preferencesStorage.getTransposition('harpa/porque-ele-vive')).toBe(3);
  });

  it('guarda tons independentes por música', () => {
    preferencesStorage.setTransposition('a', 2);
    preferencesStorage.setTransposition('b', -4);

    expect(preferencesStorage.getTransposition('a')).toBe(2);
    expect(preferencesStorage.getTransposition('b')).toBe(-4);
  });

  it('sobrescreve o tom anterior da mesma música', () => {
    preferencesStorage.setTransposition('a', 2);
    preferencesStorage.setTransposition('a', 5);
    expect(preferencesStorage.getTransposition('a')).toBe(5);
  });

  it('voltar ao tom original (0) remove a entrada do mapa', () => {
    preferencesStorage.setTransposition('a', 2);
    preferencesStorage.setTransposition('a', 0);

    expect(preferencesStorage.getTransposition('a')).toBe(0);
    // Não deve sobrar lixo no armazenamento.
    expect(Object.keys(preferencesStorage.getSnapshot().transpositions)).toEqual([]);
  });

  it('limpa todos os tons salvos', () => {
    preferencesStorage.setTransposition('a', 2);
    preferencesStorage.setTransposition('b', 3);
    preferencesStorage.clearTranspositions();

    expect(preferencesStorage.getSnapshot().transpositions).toEqual({});
  });

  it('persiste no localStorage', () => {
    preferencesStorage.setTransposition('harpa/grandioso-es-tu', -2);
    const raw = localStorage.getItem('cifras-capela:preferences');
    expect(raw).toContain('grandioso-es-tu');
    expect(raw).toContain('-2');
  });

  it('não muta o snapshot anterior (imutabilidade)', () => {
    preferencesStorage.setTransposition('a', 1);
    const before = preferencesStorage.getSnapshot().transpositions;

    preferencesStorage.setTransposition('b', 2);

    expect(before).toEqual({ a: 1 });
    expect(preferencesStorage.getSnapshot().transpositions).toEqual({ a: 1, b: 2 });
  });
});
