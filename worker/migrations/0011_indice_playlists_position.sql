-- A listagem passou a ordenar por `position` (0010), não mais por
-- `updated_at` — o índice antigo não ajudava mais essa consulta.
DROP INDEX IF EXISTS idx_playlists_user;
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists (user_id, position DESC);

-- A busca pelas compartilhadas (`WHERE shared = 1`) varria a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_playlists_shared ON playlists (shared) WHERE shared = 1;
