-- Dois níveis de usuário:
--   'admin'  → faz tudo (criar, editar, importar e excluir músicas e usuários);
--   'leitor' → só consome o site (abre a biblioteca e monta as próprias playlists).
--
-- Quem já existia continua administrador: eram todos criados à mão por SQL.

ALTER TABLE admin_users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
