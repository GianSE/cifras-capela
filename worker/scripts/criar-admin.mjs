/**
 * Gera o SQL que cria (ou atualiza a senha de) um administrador.
 *
 * Não há cadastro pelo site: quem edita a biblioteca é definido aqui. O hash
 * usa o mesmo PBKDF2-SHA256 do Worker (`src/lib/crypto.ts`), então a senha em
 * texto puro nunca sai desta máquina.
 *
 *   node scripts/criar-admin.mjs "email@exemplo.com" "Seu Nome" "senha"
 *
 * Depois aplique com:
 *   npx wrangler d1 execute cifras-db --remote --command "<SQL>"
 */

import { webcrypto as crypto } from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;
const enc = new TextEncoder();

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}

const [email, name, password] = process.argv.slice(2);

if (!email || !name || !password) {
  console.error('Uso: node scripts/criar-admin.mjs "email" "Nome" "senha"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('A senha precisa de ao menos 8 caracteres.');
  process.exit(1);
}

const hash = await hashPassword(password);
// Aspas simples dobradas: é assim que SQLite escapa dentro de uma string.
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

console.log(
  `INSERT INTO admin_users (email, name, password_hash) VALUES (${q(email.trim().toLowerCase())}, ${q(name)}, ${q(hash)}) ` +
    `ON CONFLICT (email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash;`,
);
