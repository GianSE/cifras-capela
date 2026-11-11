-- De volta: a 0002 tinha isto e a 0004 tirou, confiando só no id (aleatório)
-- como "link = acesso". Mas sem aparecer na listagem de quem não é o dono,
-- ninguém achava uma playlist que não fosse a própria sem já ter o link.
--
-- `shared` controla só a LISTAGEM (quem mais vê na própria lista de
-- playlists); abrir pelo link continua como está — quem está logado e tem o
-- id abre, compartilhada ou não. Só o dono liga ou desliga.
ALTER TABLE playlists ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;
