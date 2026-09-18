/**
 * Contas do site (`/api/users`), gerenciadas por quem é administrador.
 *
 * Não há cadastro aberto: o administrador cria as contas e diz o que cada uma
 * pode — tudo (`admin`) ou só consumir o site (`leitor`). A senha nunca é
 * devolvida nem guardada em texto puro (PBKDF2-SHA256, como no login).
 */

import type { Env } from '../types';
import { json, readJson, methodNotAllowed, unauthorized } from '../lib/http';
import { currentAccount, forbidden, toRole, type Role } from '../lib/access';
import { hashPassword } from '../lib/crypto';

const MIN_PASSWORD = 8;

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface UserBody {
  email: string;
  name: string;
  password: string;
  role: string;
}

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
  const id = rest ? Number.parseInt(rest, 10) : null;
  if (rest && (id === null || Number.isNaN(id))) {
    return json({ error: 'Usuário inválido.' }, 400);
  }

  if (id === null) {
    switch (request.method) {
      case 'GET': {
        const { results } = await env.DB.prepare(
          `SELECT id, email, name, role, created_at FROM admin_users ORDER BY name COLLATE NOCASE`,
        ).all<UserRow>();
        return json({ users: (results ?? []).map(rowToUser) });
      }
      case 'POST':
        return createUser(request, env);
      default:
        return methodNotAllowed();
    }
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

async function createUser(request: Request, env: Env): Promise<Response> {
  const body = await readJson<UserBody>(request);
  const email = (body.email ?? '').trim().toLowerCase();
  const name = (body.name ?? '').trim();
  const password = body.password ?? '';
  const role: Role = toRole(body.role);

  if (!email.includes('@')) return json({ error: 'Informe um e-mail válido.' }, 400);
  if (!name) return json({ error: 'Informe o nome.' }, 400);
  if (password.length < MIN_PASSWORD) {
    return json({ error: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
  }

  const existing = await env.DB.prepare(`SELECT id FROM admin_users WHERE email = ?`)
    .bind(email)
    .first<{ id: number }>();
  if (existing) return json({ error: 'Já existe uma conta com esse e-mail.' }, 409);

  const hash = await hashPassword(password);
  const { meta } = await env.DB.prepare(
    `INSERT INTO admin_users (email, name, password_hash, role) VALUES (?, ?, ?, ?)`,
  )
    .bind(email, name, hash, role)
    .run();

  return json({ id: meta.last_row_id, email, name, role }, 201);
}

async function updateUser(
  request: Request,
  env: Env,
  id: number,
  myId: number,
): Promise<Response> {
  const body = await readJson<Partial<UserBody>>(request);

  const current = await env.DB.prepare(`SELECT id, email, name, role, created_at FROM admin_users WHERE id = ?`)
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

  if (typeof body.password === 'string' && body.password !== '') {
    if (body.password.length < MIN_PASSWORD) {
      return json({ error: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
    }
    const hash = await hashPassword(body.password);
    await env.DB.prepare(`UPDATE admin_users SET name = ?, role = ?, password_hash = ? WHERE id = ?`)
      .bind(name, role, hash, id)
      .run();
  } else {
    await env.DB.prepare(`UPDATE admin_users SET name = ?, role = ? WHERE id = ?`)
      .bind(name, role, id)
      .run();
  }

  return json({ id, email: current.email, name, role });
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
