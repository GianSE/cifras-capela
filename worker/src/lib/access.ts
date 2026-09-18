/**
 * Quem está pedindo, e o que pode fazer.
 *
 * O papel é lido do banco a cada requisição, não do cookie: assim rebaixar
 * alguém para leitor (ou excluir a conta) vale na hora, sem esperar os 30 dias
 * do token. É uma consulta por id, no mesmo D1 que a rota já vai usar.
 */

import type { Env } from '../types';
import { json } from './http';
import { currentUser } from './session';

export type Role = 'admin' | 'leitor';

export interface Account {
  id: number;
  email: string;
  name: string;
  role: Role;
}

interface AccountRow {
  id: number;
  email: string;
  name: string;
  role: string;
}

/** Conta de quem fez a requisição, ou `null` sem sessão válida. */
export async function currentAccount(request: Request, env: Env): Promise<Account | null> {
  const token = await currentUser(request, env.JWT_SECRET);
  if (!token) return null;

  const row = await env.DB.prepare(`SELECT id, email, name, role FROM admin_users WHERE id = ?`)
    .bind(token.sub)
    .first<AccountRow>();

  // Conta excluída enquanto o cookie ainda valia.
  if (!row) return null;

  return { id: row.id, email: row.email, name: row.name, role: toRole(row.role) };
}

/** Qualquer valor estranho na coluna vira o papel mais restrito. */
export function toRole(value: unknown): Role {
  return value === 'admin' ? 'admin' : 'leitor';
}

export const forbidden = () =>
  json({ error: 'Só administradores podem fazer isso.' }, 403);
