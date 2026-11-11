/** Token aleatório de uso único (convite, redefinir senha...), em base64url. */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** `datetime('now')` do SQLite vem como `YYYY-MM-DD HH:MM:SS`, em UTC sem `Z`. */
export function sqlDateToMillis(value: string): number {
  return new Date(`${value.replace(' ', 'T')}Z`).getTime();
}
