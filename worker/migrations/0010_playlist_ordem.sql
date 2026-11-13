-- Ordem da LISTA de playlists (não das músicas dentro dela): maior valor
-- aparece primeiro. Nasce pela ordem de criação; o arrastar-e-soltar da
-- listagem reatribui os valores depois.
ALTER TABLE playlists ADD COLUMN position REAL NOT NULL DEFAULT 0;

UPDATE playlists SET position = CAST(strftime('%s', created_at) AS REAL);
