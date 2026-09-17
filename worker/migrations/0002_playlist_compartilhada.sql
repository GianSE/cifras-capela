-- Playlist compartilhada: quando ligada, qualquer pessoa com o link (inclusive
-- quem entrou como convidado) consegue ver a playlist. Só o dono continua
-- podendo alterá-la.

ALTER TABLE playlists ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;
