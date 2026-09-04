/**
 * Criptografia com Web Crypto (SubtleCrypto), disponível no Workers sem
 * dependência alguma — é por isso que este arquivo é uma cópia fiel do
 * equivalente no site-capela em vez de uma biblioteca de JWT.
 *  - Senhas: PBKDF2-SHA256 com salt aleatório.
 *  - Sessão: JWT HS256 assinado com JWT_SECRET.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- Base64URL ----------
function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- Senhas (PBKDF2) ----------
const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, rawIterations, rawSalt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2' || !rawIterations || !rawSalt || !expected) return false;

  const iterations = Number(rawIterations);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const bits = await deriveBits(password, b64urlDecode(rawSalt), iterations);
  const actual = b64urlEncode(new Uint8Array(bits));
  return timingSafeEqual(actual, expected);
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- JWT (HS256) ----------
export interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  exp: number;
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = await hmac(body, secret);
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const [header, claims, signature] = token.split('.');
  if (!header || !claims || !signature) return null;

  const body = `${header}.${claims}`;
  const sig = await hmac(body, secret);
  if (!timingSafeEqual(b64urlEncode(new Uint8Array(sig)), signature)) return null;

  try {
    const payload = JSON.parse(dec.decode(b64urlDecode(claims))) as JwtPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function b64urlJson(obj: unknown): string {
  return b64urlEncode(enc.encode(JSON.stringify(obj)));
}

async function hmac(data: string, secret: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, enc.encode(data));
}
