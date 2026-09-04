/**
 * Sessão de quem edita: JWT HS256 num cookie httpOnly.
 *
 * Mesmo desenho do site-capela, mas sem Hono — este Worker faz roteamento na
 * mão e não tem dependências, então os cookies são montados aqui (são duas
 * funções pequenas; puxar um framework inteiro por causa delas não se paga).
 */

import { verifyJwt, type JwtPayload } from './crypto';

export const COOKIE_NAME = 'cifras_session';
export const SESSION_DAYS = 30;

/** Lê um cookie do cabeçalho `Cookie` da requisição. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/**
 * Monta o `Set-Cookie` da sessão.
 *
 * `HttpOnly` mantém o token fora do alcance do JavaScript (é o ganho sobre
 * guardar em localStorage); `SameSite=Lax` basta porque o app e a API vivem
 * na mesma origem — não há requisição entre sites para proteger.
 */
export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 86_400}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** `Set-Cookie` que apaga a sessão (mesmos atributos, validade zerada). */
export function clearCookie(secure: boolean): string {
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** Payload da sessão, ou `null` se não houver cookie válido. */
export async function currentUser(
  request: Request,
  secret: string | undefined,
): Promise<JwtPayload | null> {
  if (!secret) return null;
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  return verifyJwt(token, secret);
}
