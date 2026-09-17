-- Vídeo de referência da música no YouTube (só o id, 11 caracteres).
--
-- A fonte da verdade continua sendo o `youtube:` no frontmatter do `.cho`; a
-- coluna é a cópia derivada que deixa a lista mostrar o botão de play sem abrir
-- cada cifra — o mesmo papel de `title`, `song_key` e das demais.

ALTER TABLE songs ADD COLUMN youtube TEXT;
