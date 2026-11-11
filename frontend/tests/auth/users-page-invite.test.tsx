import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { UsersPage } from '../../src/pages/UsersPage';

const ME = { id: 1, email: 'admin@x.com', name: 'Admin', role: 'admin' as const };
const OUTRO = { id: 2, email: 'leitor@x.com', name: 'Leitor', role: 'leitor' as const, createdAt: '2026-01-01' };

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: ME, isAdmin: true }),
}));

function mockFetch(handlers: Record<string, () => unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Inesperado: ${key}`);
    return Response.json(handler());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = () => render(<MemoryRouter><UsersPage /></MemoryRouter>);

describe('Usuários — convite e redefinir senha', () => {
  it('convidar cria o convite e mostra o link pronto para copiar', async () => {
    mockFetch({
      'GET /api/users': () => ({ users: [{ ...ME, createdAt: '2026-01-01' }] }),
      'POST /api/invites': () => ({ token: 'tok123' }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Convidar/ }));
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'nova@x.com' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nova Pessoa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar convite' }));

    expect(await screen.findByText('Convite para nova@x.com')).toBeTruthy();
    const link = screen.getByDisplayValue(/\/convite\/tok123$/) as HTMLInputElement;
    expect(link.value.endsWith('/convite/tok123')).toBe(true);
  });

  it('gerar link de redefinir senha de uma conta existente', async () => {
    mockFetch({
      'GET /api/users': () => ({ users: [{ ...ME, createdAt: '2026-01-01' }, OUTRO] }),
      'POST /api/users/2/reset-link': () => ({ token: 'reset456' }),
    });
    open();

    fireEvent.click(
      await screen.findByRole('button', { name: /Gerar link para Leitor trocar a senha/ }),
    );

    expect(await screen.findByText('Link para Leitor trocar a senha')).toBeTruthy();
    const link = screen.getByDisplayValue(/\/convite\/reset456$/) as HTMLInputElement;
    expect(link.value.endsWith('/convite/reset456')).toBe(true);
  });

  it('não existe mais campo de senha na edição ou no convite', async () => {
    mockFetch({
      'GET /api/users': () => ({ users: [{ ...ME, createdAt: '2026-01-01' }, OUTRO] }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Convidar/ }));
    expect(within(screen.getByRole('dialog')).queryByLabelText(/senha/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByText('Convidar para o site')).toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]!);
    expect(within(screen.getByRole('dialog')).queryByLabelText(/senha/i)).toBeNull();
  });
});
