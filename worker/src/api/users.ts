/**
 * Contas do site (`/api/users`), gerenciadas por quem é administrador.
 *
 * Não há cadastro aberto: o administrador diz quem entra e o que cada um
 * pode — tudo (`admin`) ou só consumir o site (`leitor`). Mas a senha é de
 * quem usa a conta, nunca do administrador: contas novas nascem por convite
 * (`POST /api/invites`, em `invites.ts`) e, para trocar a senha de uma conta
 * que já existe, o administrador gera um link de redefinição aqui
 * (`POST /api/users/:id/reset-link`) — a pessoa escolhe a senha ao abri-lo.
 */

import type { Env } from '../types';
import { json, readJson, methodNotAllowed, unauthorized } from '../lib/http';
import { currentAccount, forbidden, toRole, type Role } from '../lib/access';
import { generateToken } from '../lib/tokens';

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

/** Validade do link de redefinir senha — bem mais curta que a do convite. */
const RESET_HOURS = 24;

function rowToUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: toRole(row.role),
    createdAt: row.created_at,
  };
}

/** Quantos administradores existem — o site não pode ficar sem nenhum. */
async function countAdmins(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM admin_users WHERE role = 'admin'`,
  ).first<{ total: number }>();
  return row?.total ?? 0;
}

export async function usersRoute(request: Request, env: Env, pathname: string): Promise<Response> {
  const account = await currentAccount(request, env);
  if (!account) return unauthorized();
  if (account.role !== 'admin') return forbidden();

  const rest = pathname.slice('/api/users'.length).replace(/^\//, '');
  const [idPart, action] = rest.split('/');
  const id = idPart ? Number.parseInt(idPart, 10) : null;
  if (idPart && (id === null || Number.isNaN(id))) {
    return json({ error: 'Usuário inválido.' }, 400);
  }

  if (id === null) {
    if (request.method !== 'GET') return methodNotAllowed();
    const { results } = await env.DB.prepare(
      `SELECT id, email, name, role, created_at FROM admin_users ORDER BY name COLLATE NOCASE`,
    ).all<UserRow>();
    return json({ users: (results ?? []).map(rowToUser) });
  }

  if (action === 'reset-link') {
    if (request.method !== 'POST') return methodNotAllowed();
    return createResetLink(env, id, account.id);
  }

  switch (request.method) {
    case 'PATCH':
      return updateUser(request, env, id, account.id);
    case 'DELETE':
      return deleteUser(env, id, account.id);
    default:
      return methodNotAllowed();
  }
}

async function updateUser(
  request: Request,
  env: Env,
  id: number,
  myId: number,
): Promise<Response> {
  const body = await readJson<{ name?: string; role?: string }>(request);

  const current = await env.DB.prepare(
    `SELECT id, email, name, role, created_at FROM admin_users WHERE id = ?`,
  )
    .bind(id)
    .first<UserRow>();
  if (!current) return json({ error: 'Usuário não encontrado.' }, 404);

  const name = typeof body.name === 'string' ? body.name.trim() : current.name;
  if (!name) return json({ error: 'Informe o nome.' }, 400);

  const role: Role = typeof body.role === 'string' ? toRole(body.role) : toRole(current.role);

  // Rebaixar o último administrador deixaria o site sem quem cria contas.
  if (toRole(current.role) === 'admin' && role !== 'admin' && (await countAdmins(env)) <= 1) {
    return json({ error: 'É preciso manter pelo menos um administrador.' }, 409);
  }
  if (id === myId && role !== 'admin') {
    return json({ error: 'Você não pode tirar o próprio acesso de administrador.' }, 409);
  }

  await env.DB.prepare(`UPDATE admin_users SET name = ?, role = ? WHERE id = ?`)
    .bind(name, role, id)
    .run();

  return json({ id, email: current.email, name, role });
}

/**
 * Link de uso único para a própria pessoa trocar a senha — o administrador
 * nunca escolhe ou vê a senha de ninguém, só manda este link por fora.
 */
async function createResetLink(env: Env, id: number, adminId: number): Promise<Response> {
  const user = await env.DB.prepare(`SELECT id, email, name FROM admin_users WHERE id = ?`)
    .bind(id)
    .first<{ id: number; email: string; name: string }>();
  if (!user) return json({ error: 'Usuário não encontrado.' }, 404);

  const token = generateToken();
  await env.DB.prepare(
    `INSERT INTO invite_tokens (token, kind, email, name, user_id, created_by, expires_at)
     VALUES (?, 'redefinir', ?, ?, ?, ?, datetime('now', '+${RESET_HOURS} hours'))`,
  )
    .bind(token, user.email, user.name, id, adminId)
    .run();

  return json({ token }, 201);
}

async function deleteUser(env: Env, id: number, myId: number): Promise<Response> {
  if (id === myId) return json({ error: 'Você não pode excluir a própria conta.' }, 409);

  const target = await env.DB.prepare(`SELECT role FROM admin_users WHERE id = ?`)
    .bind(id)
    .first<{ role: string }>();
  if (!target) return json({ error: 'Usuário não encontrado.' }, 404);

  if (toRole(target.role) === 'admin' && (await countAdmins(env)) <= 1) {
    return json({ error: 'É preciso manter pelo menos um administrador.' }, 409);
  }

  // As playlists da conta somem junto (ON DELETE CASCADE).
  await env.DB.prepare(`DELETE FROM admin_users WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}
