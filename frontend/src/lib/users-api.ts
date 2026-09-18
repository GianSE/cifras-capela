/**
 * @module lib/users-api
 * @description Contas do site (`/api/users`). Só administradores enxergam
 * estas rotas — o Worker recusa as demais com 403.
 */

import type { Role } from '@/hooks/useAuth';

export interface AppUser {
  readonly id: number;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly createdAt: string;
}

export interface UserInput {
  readonly email?: string;
  readonly name: string;
  readonly role: Role;
  /** Vazio ao editar = mantém a senha atual. */
  readonly password?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin', ...init });
  } catch {
    throw new Error('Sem conexão com o servidor.');
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error ?? 'Não foi possível concluir.');
  return data;
}

export async function listUsers(): Promise<AppUser[]> {
  const data = await request<{ users: AppUser[] }>('/api/users');
  return data.users;
}

export function createUser(input: UserInput): Promise<AppUser> {
  return request<AppUser>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateUser(id: number, input: UserInput): Promise<AppUser> {
  return request<AppUser>(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteUser(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/users/${id}`, { method: 'DELETE' });
}
