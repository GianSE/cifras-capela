-- Fim do interruptor de compartilhar: ler uma playlist passou a depender só de
-- ter o link (o id é aleatório), então a coluna não é mais consultada.

ALTER TABLE playlists DROP COLUMN shared;
