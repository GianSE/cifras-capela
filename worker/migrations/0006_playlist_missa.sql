-- Playlist do tipo missa: organizada pelas partes da celebração (Entrada,
-- Glória, Santo…), cada uma com as suas músicas.
--
-- `kind` = 'lista' (setlist comum) ou 'missa'. `sections` guarda as partes
-- como JSON — '[{"id":"sec_…","name":"Entrada","songIds":["…"]}]' —, e
-- `song_ids` continua com todas as músicas em ordem, para quem só precisa
-- da fila (leitor, PDF, contagens).

ALTER TABLE playlists ADD COLUMN kind TEXT NOT NULL DEFAULT 'lista';
ALTER TABLE playlists ADD COLUMN sections TEXT;
