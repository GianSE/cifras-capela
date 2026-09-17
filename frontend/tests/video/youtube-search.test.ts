import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchYoutube } from '../../src/lib/youtube-search';

const resposta = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });

afterEach(() => vi.unstubAllGlobals());

describe('searchYoutube', () => {
  it('devolve os resultados e pede a busca ao Worker', async () => {
    const fetchMock = resposta(200, { results: [{ id: 'vpp-DP1JTLk', title: 'Tu És o Centro' }] });
    vi.stubGlobal('fetch', fetchMock);

    const res = await searchYoutube('Tu És o Centro Frei Gilson');

    expect(res).toEqual({ status: 'ok', results: [{ id: 'vpp-DP1JTLk', title: 'Tu És o Centro' }] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/youtube/search?q=Tu%20%C3%89s%20o%20Centro%20Frei%20Gilson',
    );
  });

  it('501 vira "not-configured" — o app cai no link manual', async () => {
    vi.stubGlobal('fetch', resposta(501, { reason: 'not-configured' }));
    expect(await searchYoutube('x')).toEqual({ status: 'not-configured' });
  });

  it('repassa a mensagem de erro do servidor (ex.: cota do dia)', async () => {
    vi.stubGlobal('fetch', resposta(429, { error: 'A busca do YouTube atingiu o limite de hoje.' }));
    expect(await searchYoutube('x')).toEqual({
      status: 'error',
      message: 'A busca do YouTube atingiu o limite de hoje.',
    });
  });

  it('sem rede, avisa em vez de quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await searchYoutube('x')).toEqual({
      status: 'error',
      message: 'Sem conexão com o servidor.',
    });
  });
});
