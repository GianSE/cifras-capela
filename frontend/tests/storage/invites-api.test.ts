import { describe, it, expect, vi, afterEach } from 'vitest';
import { acceptInvite, createInvite, createResetLink, inviteUrl, peekInvite } from '../../src/lib/invites-api';

const resposta = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });

afterEach(() => vi.unstubAllGlobals());

describe('convite de conta e redefinir senha', () => {
  it('cria o convite e devolve o token', async () => {
    const fetchMock = resposta(201, { token: 'abc123' });
    vi.stubGlobal('fetch', fetchMock);

    const { token } = await createInvite({ email: 'a@x.com', name: 'Ana', role: 'leitor' });
    expect(token).toBe('abc123');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/invites',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('o link do convite usa o endereço do próprio site', () => {
    expect(inviteUrl('abc123')).toBe(`${location.origin}/convite/abc123`);
  });

  it('gera o link de redefinir senha de uma conta existente', async () => {
    const fetchMock = resposta(201, { token: 'xyz' });
    vi.stubGlobal('fetch', fetchMock);

    const { token } = await createResetLink(7);
    expect(token).toBe('xyz');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/7/reset-link',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('confere o link antes de pedir a senha', async () => {
    vi.stubGlobal(
      'fetch',
      resposta(200, { kind: 'convite', email: 'a@x.com', name: 'Ana' }),
    );
    const info = await peekInvite('abc123');
    expect(info).toEqual({ kind: 'convite', email: 'a@x.com', name: 'Ana' });
  });

  it('link vencido ou já usado dá erro claro', async () => {
    vi.stubGlobal('fetch', resposta(404, { error: 'Esse link não é mais válido. Peça um novo.' }));
    await expect(peekInvite('velho')).rejects.toThrow('Esse link não é mais válido');
  });

  it('aceitar o convite manda a senha escolhida', async () => {
    const fetchMock = resposta(200, { id: 1, email: 'a@x.com', name: 'Ana', role: 'leitor' });
    vi.stubGlobal('fetch', fetchMock);

    await acceptInvite('abc123', 'senha-bem-forte');
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      password: 'senha-bem-forte',
    });
  });
});
