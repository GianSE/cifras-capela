/**
 * Convite de conta e recuperação de senha: um link de uso único que o
 * administrador copia e manda por fora (WhatsApp, e-mail...) — o site não
 * manda e-mail sozinho, então não há "esqueci a senha" aberto ao público;
 * só quem administra pode gerar o link (em Usuários).
 *
 *   POST /api/invites        → cria um convite (admin)
 *   GET  /api/invites/:token → o que esse link faz, pra mostrar na tela (público)
 *   POST /api/invites/:token → aceita: escolhe a senha e já entra (público)
 *
 * O link de redefinir senha de uma conta existente nasce em
 * `POST /api/users/:id/reset-link` (`users.ts`) — é a mesma tabela e as
 * mesmas duas rotas públicas que o atendem, só o `kind` que muda.
 */

import type { Env } from '../types';
import { json, readJson, methodNotAllowed, unauthorized } from '../lib/http';
import { currentAccount, forbidden, toRole, type Role } from '../lib/access';
import { hashPassword, signJwt } from '../lib/crypto';
import { sessionCookie, SESSION_DAYS } from '../lib/session';
import { generateToken, sqlDateToMillis } from '../lib/tokens';

const MIN_PASSWORD = 8;
const INVITE_DAYS = 7;

interface TokenRow {
  token: string;
  kind: 'convite' | 'redefinir';
  email: string;
  name: string | null;
  role: string | null;
  user_id: number | null;
  expires_at: string;
  used_at: string | null;
}

const EXPIRED = () => json({ error: 'Esse link não é mais válido. Peça um novo.' }, 404);

export async function invitesRoute(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const rest = pathname.slice('/api/invites'.length).replace(/^\//, '');

  if (!rest) {
    if (request.method !== 'POST') return methodNotAllowed();
    return createInvite(request, env);
  }

  const token = decodeURIComponent(rest);
  switch (request.method) {
    case 'GET':
      return peekToken(env, token);
    case 'POST':
      return acceptToken(request, env, token);
    default:
      return methodNotAllowed();
  }
}

async function createInvite(request: Request, env: Env): Promise<Response> {
  const account = await currentAccount(request, env);
  if (!account) return unauthorized();
  if (account.role !== 'admin') return forbidden();

  const body = await readJson<{ email?: string; name?: string; role?: string }>(request);
  const email = (body.email ?? '').trim().toLowerCase();
  const name = (body.name ?? '').trim();
  const role: Role = toRole(body.role);

  if (!email.includes('@')) return json({ error: 'Informe um e-mail válido.' }, 400);
  if (!name) return json({ error: 'Informe o nome.' }, 400);

  const existing = await env.DB.prepare(`SELECT id FROM admin_users WHERE email = ?`)
    .bind(email)
    .first<{ id: number }>();
  if (existing) {
    return json(
      {
        error:
          'Já existe uma conta com esse e-mail. Para trocar a senha dela, use "Gerar link para redefinir a senha" na própria conta.',
      },
      409,
    );
  }

  const token = generateToken();
  await env.DB.prepare(
    `INSERT INTO invite_tokens (token, kind, email, name, role, created_by, expires_at)
     VALUES (?, 'convite', ?, ?, ?, ?, datetime('now', '+${INVITE_DAYS} days'))`,
  )
    .bind(token, email, name, role, account.id)
    .run();

  return json({ token }, 201);
}

async function peekToken(env: Env, token: string): Promise<Response> {
  const row = await findValidToken(env, token);
  if (!row) return EXPIRED();
  return json({ kind: row.kind, email: row.email, name: row.name ?? '' });
}

async function findValidToken(env: Env, token: string): Promise<TokenRow | null> {
  const row = await env.DB.prepare(
    `SELECT token, kind, email, name, role, user_id, expires_at, used_at
       FROM invite_tokens WHERE token = ?`,
  )
    .bind(token)
    .first<TokenRow>();

  if (!row || row.used_at) return null;
  if (sqlDateToMillis(row.expires_at) < Date.now()) return null;
  return row;
}

async function acceptToken(request: Request, env: Env, token: string): Promise<Response> {
  if (!env.JWT_SECRET) return json({ error: 'Login não configurado neste servidor.' }, 503);

  const row = await findValidToken(env, token);
  if (!row) return EXPIRED();

  const body = await readJson<{ password?: string }>(request);
  const password = body.password ?? '';
  if (password.length < MIN_PASSWORD) {
    return json({ error: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
  }

  const hash = await hashPassword(password);
  let userId: number;
  let name: string;
  let role: Role;
  let email = row.email;

  if (row.kind === 'convite') {
    const existing = await env.DB.prepare(`SELECT id FROM admin_users WHERE email = ?`)
      .bind(row.email)
      .first<{ id: number }>();
    if (existing) return json({ error: 'Essa conta já existe. Entre normalmente.' }, 409);

    name = row.name ?? '';
    role = toRole(row.role);
    const { meta } = await env.DB.prepare(
      `INSERT INTO admin_users (email, name, password_hash, role) VALUES (?, ?, ?, ?)`,
    )
      .bind(row.email, name, hash, role)
      .run();
    userId = Number(meta.last_row_id);
  } else {
    if (!row.user_id) return EXPIRED();
    const current = await env.DB.prepare(
      `SELECT id, email, name, role FROM admin_users WHERE id = ?`,
    )
      .bind(row.user_id)
      .first<{ id: number; email: string; name: string; role: string }>();
    if (!current) return json({ error: 'Essa conta não existe mais.' }, 404);

    await env.DB.prepare(`UPDATE admin_users SET password_hash = ? WHERE id = ?`)
      .bind(hash, row.user_id)
      .run();
    userId = current.id;
    name = current.name;
    role = toRole(current.role);
    email = current.email;
  }

  await env.DB.prepare(`UPDATE invite_tokens SET used_at = datetime('now') WHERE token = ?`)
    .bind(token)
    .run();

  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86_400;
  const jwt = await signJwt({ sub: userId, email, name, exp }, env.JWT_SECRET);

  return json(
    { id: userId, email, name, role },
    200,
    { 'Set-Cookie': sessionCookie(jwt, env.APP_ENV !== 'development') },
  );
}
