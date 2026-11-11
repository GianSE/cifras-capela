-- Convite de conta e recuperação de senha: um link de uso único, que o
-- administrador copia e manda por fora (WhatsApp, e-mail...) — o site não
-- manda e-mail sozinho.
--
--   'convite'   → cria a conta (e-mail/nome/papel definidos pelo administrador)
--                 quando a pessoa escolhe a própria senha.
--   'redefinir' → troca a senha de uma conta que já existe (user_id aponta pra ela).
--
-- Expira sozinho (expires_at) e vale uma vez só (used_at marca o uso).
CREATE TABLE IF NOT EXISTS invite_tokens (
  token      TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('convite', 'redefinir')),
  email      TEXT NOT NULL,
  name       TEXT,
  role       TEXT,
  user_id    INTEGER REFERENCES admin_users (id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_email ON invite_tokens (email);
