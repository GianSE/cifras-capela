-- Folhas: fotos e PDFs de cifra guardados no R2 (bucket `cifras-folhas`) para
-- transcrever depois. O arquivo fica em `folhas/<id>` no bucket; aqui fica o
-- índice.
--
-- `status`: 'pendente' (ainda não virou cifra) ou 'validada' (alguém revisou a
-- transcrição e confirmou). Validada, `song_id` aponta a música gerada — e a
-- folha continua guardada como cópia de segurança do original.

CREATE TABLE IF NOT EXISTS scans (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER REFERENCES admin_users (id) ON DELETE SET NULL,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pendente',
  song_id      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scans_created ON scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_song ON scans (song_id);
