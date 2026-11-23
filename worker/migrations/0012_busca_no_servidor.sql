-- Busca por trecho de letra no servidor, com FTS5.
--
-- Antes, `/api/songs` mandava a letra de **todas** as músicas para o app
-- indexar no MiniSearch. Com a biblioteca perto de 15 mil cifras isso virou
-- 12 MB por abertura, não cabia na cota do localStorage (o cache offline
-- falhava calado) e reindexar tudo travava o celular.
--
-- Agora o índice vai sem letra e quem procura por um trecho é o banco.
--
-- `content='songs'` é FTS5 de conteúdo externo: o índice guarda só os termos e
-- aponta de volta para `songs` pelo rowid, sem duplicar os 12 MB de texto.
--
-- `remove_diacritics 2` dobra os acentos no índice **e** na consulta, que é o
-- que a busca do app já fazia à mão: no celular ninguém digita acento, e o
-- repertório é cheio deles.
CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
  title,
  artist,
  lyrics,
  content='songs',
  content_rowid='rowid',
  tokenize="unicode61 remove_diacritics 2"
);

-- Preenche a partir das músicas que já existem.
INSERT INTO songs_fts (songs_fts) VALUES ('rebuild');

-- Os gatilhos mantêm o índice de pé sozinho — inclusive quando alguém mexe na
-- tabela por SQL solto, fora do Worker (uma limpeza de duplicatas, por
-- exemplo). Sem eles o índice apontaria para linhas que não existem mais.
CREATE TRIGGER IF NOT EXISTS songs_fts_insert AFTER INSERT ON songs BEGIN
  INSERT INTO songs_fts (rowid, title, artist, lyrics)
    VALUES (new.rowid, new.title, new.artist, new.lyrics);
END;

CREATE TRIGGER IF NOT EXISTS songs_fts_delete AFTER DELETE ON songs BEGIN
  INSERT INTO songs_fts (songs_fts, rowid, title, artist, lyrics)
    VALUES ('delete', old.rowid, old.title, old.artist, old.lyrics);
END;

CREATE TRIGGER IF NOT EXISTS songs_fts_update AFTER UPDATE ON songs BEGIN
  INSERT INTO songs_fts (songs_fts, rowid, title, artist, lyrics)
    VALUES ('delete', old.rowid, old.title, old.artist, old.lyrics);
  INSERT INTO songs_fts (rowid, title, artist, lyrics)
    VALUES (new.rowid, new.title, new.artist, new.lyrics);
END;

-- A listagem ordena por `title COLLATE NOCASE`, mas o índice de 0001 é sobre
-- `title` sem collation — colação diferente, então o SQLite o ignorava e fazia
-- varredura completa mais ordenação a cada carregamento da biblioteca.
CREATE INDEX IF NOT EXISTS idx_songs_title_nocase ON songs (title COLLATE NOCASE);
