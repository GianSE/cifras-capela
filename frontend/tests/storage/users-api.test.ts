import { describe, it, expect, vi, afterEach } from 'vitest';
import { createUser, deleteUser, listUsers } from '../../src/lib/users-api';

const resposta = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });

afterEach(() => vi.unstubAllGlobals());

describe('contas do site', () => {
  it('lista as contas com o papel de cada uma', async () => {
    vi.stubGlobal(
      'fetch',
      resposta(200, {
        users: [
          { id: 1, email: 'a@x.com', name: 'Ana', role: 'admin', createdAt: '2026-01-01' },
          { id: 2, email: 'b@x.com', name: 'Bento', role: 'leitor', createdAt: '2026-01-02' },
        ],
      }),
    );

    const users = await listUsers();
    expect(users.map((u) => u.role)).toEqual(['admin', 'leitor']);
  });

  it('mostra o motivo que o servidor deu (e-mail repetido)', async () => {
    vi.stubGlobal('fetch', resposta(409, { error: 'Já existe uma conta com esse e-mail.' }));
    await expect(
      createUser({ email: 'a@x.com', name: 'Ana', role: 'leitor', password: 'senha-longa' }),
    ).rejects.toThrow('Já existe uma conta com esse e-mail.');
  });

  it('quem só lê recebe 403 e vê o motivo', async () => {
    vi.stubGlobal('fetch', resposta(403, { error: 'Só administradores podem fazer isso.' }));
    await expect(listUsers()).rejects.toThrow('Só administradores');
  });

  it('sem rede, avisa em vez de quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(deleteUser(2)).rejects.toThrow('Sem conexão com o servidor.');
  });
});
