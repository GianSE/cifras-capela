/**
 * Sessão de quem edita a biblioteca: e-mail + senha, JWT em cookie httpOnly.
 *
 * Mesmo desenho do site-capela. Não há cadastro público: os administradores
 * entram na tabela `admin_users` por SQL (ver `scripts/criar-admin.mjs`) —
 * este é um acervo de uma comunidade, não um serviço com inscrição aberta.
 */

import type { Env } from '../types';
import { verifyPassword, signJwt } from '../lib/crypto';
import { json, readJson, unauthorized } from '../lib/http';
import { clearCookie, currentUser, sessionCookie, SESSION_DAYS } from '../lib/session';

interface AdminRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
}

export async function login(request: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) {
    return json({ error: 'Login não configurado neste servidor.' }, 503);
  }

  const body = await readJson<{ email: string; password: string }>(request);
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!email || !password) {
    return json({ error: 'Informe e-mail e senha.' }, 400);
  }

  const user = await env.DB.prepare(
    `SELECT id, email, name, password_hash FROM admin_users WHERE email = ?`,
  )
    .bind(email)
    .first<AdminRow>();

  // Mensagem igual nos dois casos: dizer "e-mail não existe" entregaria quais
  // endereços têm conta. O PBKDF2 roda mesmo sem usuário, para o tempo de
  // resposta não denunciar a diferença.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, 'pbkdf2$100000$aaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbb');

  if (!user || !ok) {
    return json({ error: 'E-mail ou senha inválidos.' }, 401);
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86_400;
  const token = await signJwt(
    { sub: user.id, email: user.email, name: user.name, exp },
    env.JWT_SECRET,
  );

  return json(
    { id: user.id, email: user.email, name: user.name },
    200,
    { 'Set-Cookie': sessionCookie(token, env.APP_ENV !== 'development') },
  );
}

export function logout(env: Env): Response {
  return json({ ok: true }, 200, {
    'Set-Cookie': clearCookie(env.APP_ENV !== 'development'),
  });
}

export async function me(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env.JWT_SECRET);
  if (!user) return unauthorized();
  return json({ id: user.sub, email: user.email, name: user.name });
}
