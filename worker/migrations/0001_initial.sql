-- Esquema inicial: músicas, administradores e playlists.
--
-- D1 é SQLite: não há tipo array nem JSONB. `categories`, `tags` e `song_ids`
-- são guardados como JSON em TEXT e convertidos na borda (worker), mantendo o
-- mesmo formato que o app já consumia do Supabase.

CREATE TABLE IF NOT EXISTS songs (
  -- Slug com pasta: `harpa-crista/porque-ele-vive`.
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  artist      TEXT,
  -- `key` é palavra reservada em SQL; a coluna é `song_key`.
  song_key    TEXT,
  tempo       INTEGER,
  capo        INTEGER,
  -- JSON: '["culto","natal"]'
  categories  TEXT NOT NULL DEFAULT '[]',
  tags        TEXT NOT NULL DEFAULT '[]',
  language    TEXT,
  -- Letra em texto puro, só para busca.
  lyrics      TEXT,
  -- O arquivo `.cho` completo — a fonte da verdade.
  source      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A biblioteca é listada sempre em ordem alfabética.
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs (title);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  -- PBKDF2-SHA256: 'pbkdf2$iteracoes$salt$hash'
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlists (
  -- Gerado no cliente (mesmo formato do localStorage), para o app poder
  -- devolver o id de forma síncrona ao criar.
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  -- JSON: '["culto/amem","natal/noite-feliz"]' — a ordem importa.
  song_ids   TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists (user_id, updated_at DESC);
