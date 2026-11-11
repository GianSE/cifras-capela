/**
 * @module lib/invites-api
 * @description Convite de conta e link de redefinir senha (`/api/invites`,
 * `/api/users/:id/reset-link`). A senha nunca passa pelo administrador: ele só
 * gera o link e manda por fora (WhatsApp, e-mail...); quem recebe escolhe a
 * própria senha ao abri-lo.
 */
import type { Role } from '@/hooks/useAuth';

export interface InviteInfo {
  readonly kind: 'convite' | 'redefinir';
  readonly email: string;
  readonly name: string;
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

/** Endereço do convite/link, pronto para copiar e mandar por fora. */
export function inviteUrl(token: string): string {
  return `${location.origin}/convite/${encodeURIComponent(token)}`;
}

/** Cria o convite de uma conta nova. Quem recebe o link escolhe a própria senha. */
export function createInvite(input: {
  email: string;
  name: string;
  role: Role;
}): Promise<{ token: string }> {
  return request('/api/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** Link para trocar a senha de uma conta que já existe. */
export function createResetLink(userId: number): Promise<{ token: string }> {
  return request(`/api/users/${userId}/reset-link`, { method: 'POST' });
}

/** O que este link faz — para mostrar na tela antes de pedir a senha. */
export function peekInvite(token: string): Promise<InviteInfo> {
  return request(`/api/invites/${encodeURIComponent(token)}`);
}

/** Aceita o convite (ou a redefinição): escolhe a senha e já entra. */
export function acceptInvite(token: string, password: string): Promise<void> {
  return request(`/api/invites/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}
