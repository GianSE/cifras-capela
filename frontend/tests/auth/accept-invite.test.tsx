import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AcceptInvitePage } from '../../src/pages/AcceptInvitePage';

const resposta = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = (token = 'abc123') =>
  render(
    <MemoryRouter initialEntries={[`/convite/${token}`]}>
      <Routes>
        <Route path="/convite/:token" element={<AcceptInvitePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('AcceptInvitePage', () => {
  it('link vencido ou já usado explica o que houve, sem formulário', async () => {
    vi.stubGlobal('fetch', resposta(404, { error: 'não vale mais' }));
    open();
    expect(await screen.findByText('Link inválido')).toBeTruthy();
    expect(screen.queryByLabelText('Senha')).toBeNull();
  });

  it('convite mostra o nome e o e-mail de quem foi convidado', async () => {
    vi.stubGlobal('fetch', resposta(200, { kind: 'convite', email: 'ana@x.com', name: 'Ana' }));
    open();
    expect(await screen.findByText('Bem-vindo(a), Ana!')).toBeTruthy();
    expect(screen.getByText(/ana@x\.com/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar minha conta' })).toBeTruthy();
  });

  it('redefinir mostra o texto certo e o botão certo', async () => {
    vi.stubGlobal(
      'fetch',
      resposta(200, { kind: 'redefinir', email: 'ana@x.com', name: 'Ana' }),
    );
    open();
    expect(await screen.findByText('Olá, Ana')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trocar senha e entrar' })).toBeTruthy();
  });

  it('não deixa enviar com senhas diferentes ou curtas', async () => {
    vi.stubGlobal('fetch', resposta(200, { kind: 'convite', email: 'ana@x.com', name: 'Ana' }));
    open();
    await screen.findByText('Bem-vindo(a), Ana!');

    const botao = screen.getByRole('button', { name: 'Criar minha conta' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Confirme a senha'), { target: { value: '123' } });
    expect(screen.getByText(/pelo menos 8 caracteres/)).toBeTruthy();
    expect(botao.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-forte' } });
    fireEvent.change(screen.getByLabelText('Confirme a senha'), {
      target: { value: 'outra-coisa' },
    });
    expect(screen.getByText('As senhas não são iguais.')).toBeTruthy();
    expect(botao.disabled).toBe(true);
  });

  it('senha certa e confirmada habilita o envio', async () => {
    vi.stubGlobal('fetch', resposta(200, { kind: 'convite', email: 'ana@x.com', name: 'Ana' }));
    open();
    await screen.findByText('Bem-vindo(a), Ana!');

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-forte' } });
    fireEvent.change(screen.getByLabelText('Confirme a senha'), {
      target: { value: 'senha-forte' },
    });
    const botao = screen.getByRole('button', { name: 'Criar minha conta' }) as HTMLButtonElement;
    await waitFor(() => expect(botao.disabled).toBe(false));
  });
});
