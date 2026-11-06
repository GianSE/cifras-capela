import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from '../../src/hooks/useAuth';

const USER = { id: 7, email: 'a@b.c', name: 'Ana', role: 'admin' };
const KEY = 'cifras-capela:conta';

function mockMe(respond: () => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/auth/me') return respond();
      if (url === '/api/playlists') throw new TypeError('offline');
      return Response.json({ ok: true });
    }),
  );
}

async function signedInState() {
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe('a conta sem internet', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('online: confirma a conta e guarda para quando faltar sinal', async () => {
    mockMe(async () => Response.json(USER));
    const result = await signedInState();
    expect(result.current.user).toEqual(USER);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(USER);
  });

  it('sem rede: continua na última conta, em vez de mandar para o login', async () => {
    localStorage.setItem(KEY, JSON.stringify(USER));
    mockMe(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await signedInState();
    expect(result.current.isSignedIn).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });

  it('servidor fora do ar conta como sem rede', async () => {
    localStorage.setItem(KEY, JSON.stringify(USER));
    mockMe(async () => new Response('', { status: 503 }));
    expect((await signedInState()).current.isSignedIn).toBe(true);
  });

  it.each([401, 403])('o servidor dizer %i tira da conta de verdade', async (status) => {
    localStorage.setItem(KEY, JSON.stringify(USER));
    mockMe(async () => new Response('', { status }));
    const result = await signedInState();
    expect(result.current.isSignedIn).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('sem rede e sem conta guardada: continua fora', async () => {
    mockMe(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await signedInState()).current.isSignedIn).toBe(false);
  });

  it('conta guardada corrompida não quebra o app', async () => {
    localStorage.setItem(KEY, '{quebrado');
    mockMe(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await signedInState()).current.isSignedIn).toBe(false);
  });

  it('o papel guardado nunca vale mais do que leitor, se vier estranho', async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...USER, role: 'superusuario' }));
    mockMe(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await signedInState();
    expect(result.current.isSignedIn).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('sair apaga a conta guardada', async () => {
    mockMe(async () => Response.json(USER));
    const result = await signedInState();
    await act(() => result.current.signOut());
    expect(result.current.isSignedIn).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('entrar guarda a conta', async () => {
    mockMe(async () => new Response('', { status: 401 }));
    const result = await signedInState();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(USER)),
    );
    await act(() => result.current.signIn('a@b.c', 'x'));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ id: 7, role: 'admin' });
  });
});
