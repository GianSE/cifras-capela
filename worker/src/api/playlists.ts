/**
 * Playlists sincronizadas por usuário.
 *
 * O app continua guardando tudo em localStorage — isto aqui é a cópia que
 * permite abrir o mesmo repertório no celular e no PC. Uma playlist é de quem a
 * montou: listar, gravar e excluir exigem sessão e filtram por `user_id`.
 *
 * A exceção é ler **uma** playlist compartilhada (`GET /api/playlists/<id>`):
 * com `shared` ligado, qualquer pessoa com o link a vê — é assim que o grupo
 * que vai tocar junto abre o repertório, mesmo entrando como convidado.
 */

import type { Env } from '../types';
import { json, readJson, methodNotAllowed, unauthorized } from '../lib/http';
import { currentUser } from '../lib/session';

interface PlaylistRow {
  id: string;
  user_id: number;
  name: string;
  song_ids: string;
  shared: number;
  created_at: string;
  updated_at: string;
}

function rowToPlaylist(row: PlaylistRow) {
  return {
    id: row.id,
    name: row.name,
    songIds: parseIds(row.song_ids),
    shared: row.shared === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function playlistsRoute(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const user = await currentUser(request, env.JWT_SECRET);
  const id = decodeURIComponent(pathname.slice('/api/playlists'.length).replace(/^\//, ''));

  // Leitura de uma playlist: o dono sempre vê; os demais, só se compartilhada.
  // Não existir e não estar compartilhada respondem igual (404), para o link
  // não servir de sonda de quais ids existem.
  if (id && request.method === 'GET') {
    const row = await env.DB.prepare(
      `SELECT id, user_id, name, song_ids, shared, created_at, updated_at
         FROM playlists WHERE id = ?`,
    )
      .bind(id)
      .first<PlaylistRow>();

    const isOwner = row !== null && user !== null && row.user_id === user.sub;
    if (!row || (!isOwner && row.shared !== 1)) {
      return json({ error: 'Playlist não encontrada ou não compartilhada.' }, 404);
    }
    return json(
      { playlist: rowToPlaylist(row), isOwner },
      200,
      // Muda quando o dono reordena: nada de cache no caminho.
      { 'Cache-Control': 'no-store' },
    );
  }

  if (!user) return unauthorized();

  if (!id) {
    if (request.method !== 'GET') return methodNotAllowed();

    const { results } = await env.DB.prepare(
      `SELECT id, user_id, name, song_ids, shared, created_at, updated_at
         FROM playlists WHERE user_id = ? ORDER BY updated_at DESC`,
    )
      .bind(user.sub)
      .all<PlaylistRow>();

    return json({ playlists: (results ?? []).map(rowToPlaylist) });
  }

  if (request.method === 'PUT') {
    const body = await readJson<{
      name: string;
      songIds: string[];
      createdAt: string;
      shared: boolean;
    }>(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return json({ error: 'A playlist precisa de um nome.' }, 400);

    const songIds = JSON.stringify(
      Array.isArray(body.songIds) ? body.songIds.filter((v) => typeof v === 'string') : [],
    );

    // Sem `shared` no corpo (app de uma versão anterior), mantém o que já estava.
    const shared = typeof body.shared === 'boolean' ? (body.shared ? 1 : 0) : null;

    // `user_id` entra também no UPDATE do conflito: sem isso, conhecer o id de
    // uma playlist alheia bastaria para sobrescrevê-la.
    const result = await env.DB.prepare(
      `INSERT INTO playlists (id, user_id, name, song_ids, shared, created_at, updated_at)
       VALUES (?, ?, ?, ?, COALESCE(?, 0), COALESCE(?, datetime('now')), datetime('now'))
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         song_ids = excluded.song_ids,
         shared = CASE WHEN ? IS NULL THEN playlists.shared ELSE excluded.shared END,
         updated_at = datetime('now')
       WHERE playlists.user_id = excluded.user_id`,
    )
      .bind(
        id,
        user.sub,
        name,
        songIds,
        shared,
        typeof body.createdAt === 'string' ? body.createdAt : null,
        shared,
      )
      .run();

    // O `WHERE` acima faz o UPDATE não acontecer quando a playlist é de outra
    // pessoa. Sem olhar `changes`, a resposta seria 200 e o app acharia que
    // gravou — daí a checagem explícita.
    if (result.meta.changes === 0) {
      return json({ error: 'Essa playlist é de outra conta.' }, 403);
    }

    return json({ ok: true, id });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare(`DELETE FROM playlists WHERE id = ? AND user_id = ?`)
      .bind(id, user.sub)
      .run();
    return json({ ok: true });
  }

  return methodNotAllowed();
}
