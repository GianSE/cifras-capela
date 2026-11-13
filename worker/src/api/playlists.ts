/**
 * Playlists sincronizadas por usuário.
 *
 * O app continua guardando tudo em localStorage — isto aqui é a cópia que
 * permite abrir o mesmo repertório no celular e no PC. Uma playlist é de quem a
 * montou: gravar e excluir exigem sessão e filtram por `user_id`.
 *
 * Ler **uma** playlist pelo id (`GET /api/playlists/<id>`) continua valendo
 * para quem está logado e tem o id, mesmo sendo de outra conta — é assim que
 * o grupo que vai tocar junto abre pelo link. Já a LISTAGEM (`GET
 * /api/playlists`) só traz as suas, a não ser que o dono tenha ligado
 * `shared` — aí ela aparece na lista de todo mundo também, não só de quem já
 * tinha o link.
 */

import type { Env } from '../types';
import { json, readJson, methodNotAllowed, unauthorized } from '../lib/http';
import { currentAccount } from '../lib/access';

interface PlaylistRow {
  id: string;
  user_id: number;
  name: string;
  song_ids: string;
  kind: string | null;
  sections: string | null;
  shared: number;
  position: number;
  owner_name?: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPlaylist(row: PlaylistRow, viewerId: number) {
  const isOwner = row.user_id === viewerId;
  return {
    id: row.id,
    name: row.name,
    songIds: parseIds(row.song_ids),
    kind: row.kind === 'missa' ? 'missa' : 'lista',
    sections: row.kind === 'missa' ? parseSections(row.sections) : null,
    shared: row.shared === 1,
    position: row.position,
    isOwner,
    ...(!isOwner && row.owner_name && { ownerName: row.owner_name }),
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

interface Section {
  id: string;
  name: string;
  songIds: string[];
}

/** Partes da missa: descarta o que não tiver o formato esperado. */
function sanitizeSections(value: unknown): Section[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (s): s is Record<string, unknown> =>
        typeof s === 'object' &&
        s !== null &&
        typeof s.id === 'string' &&
        typeof s.name === 'string',
    )
    .map((s) => ({
      id: String(s.id).slice(0, 64),
      name: String(s.name).trim().slice(0, 80) || 'Parte',
      songIds: Array.isArray(s.songIds)
        ? s.songIds.filter((v): v is string => typeof v === 'string')
        : [],
    }));
}

function parseSections(value: string | null): Section[] {
  if (!value) return [];
  try {
    return sanitizeSections(JSON.parse(value));
  } catch {
    return [];
  }
}

export async function playlistsRoute(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const user = await currentAccount(request, env);
  if (!user) return unauthorized();

  const id = decodeURIComponent(pathname.slice('/api/playlists'.length).replace(/^\//, ''));

  // Arrastar-e-soltar na LISTAGEM de playlists (não as músicas de dentro):
  // `ids` já vem na ordem desejada, de cima para baixo.
  if (id === '_reorder' && request.method === 'PUT') {
    const body = await readJson<{ ids: string[] }>(request);
    const ids = Array.isArray(body.ids) ? body.ids.filter((v) => typeof v === 'string') : [];
    if (ids.length === 0) return json({ ok: true });

    await env.DB.batch(
      ids.map((playlistId, index) =>
        env.DB.prepare(`UPDATE playlists SET position = ? WHERE id = ? AND user_id = ?`).bind(
          ids.length - index,
          playlistId,
          user.id,
        ),
      ),
    );
    return json({ ok: true });
  }

  // Leitura de uma playlist: basta ter o link.
  if (id && request.method === 'GET') {
    const row = await env.DB.prepare(
      `SELECT id, user_id, name, song_ids, kind, sections, shared, position, created_at, updated_at
         FROM playlists WHERE id = ?`,
    )
      .bind(id)
      .first<PlaylistRow>();

    if (!row) {
      return json({ error: 'Playlist não encontrada.' }, 404);
    }
    const playlist = rowToPlaylist(row, user.id);
    return json(
      { playlist, isOwner: playlist.isOwner },
      200,
      // Muda quando o dono reordena: nada de cache no caminho.
      { 'Cache-Control': 'no-store' },
    );
  }

  if (!id) {
    if (request.method !== 'GET') return methodNotAllowed();

    // As suas + as que o dono ligou para todo mundo ver. O nome do dono só
    // interessa nessas últimas — é o que diferencia "sua" de "compartilhada"
    // na lista.
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.user_id, p.name, p.song_ids, p.kind, p.sections, p.shared, p.position,
              p.created_at, p.updated_at, u.name AS owner_name
         FROM playlists p
         LEFT JOIN admin_users u ON u.id = p.user_id
        WHERE p.user_id = ? OR p.shared = 1
        ORDER BY p.position DESC`,
    )
      .bind(user.id)
      .all<PlaylistRow>();

    return json({ playlists: (results ?? []).map((row) => rowToPlaylist(row, user.id)) });
  }

  if (request.method === 'PUT') {
    const body = await readJson<{
      name: string;
      songIds: string[];
      kind?: string;
      sections?: unknown;
      shared?: boolean;
      createdAt: string;
    }>(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return json({ error: 'A playlist precisa de um nome.' }, 400);

    const songIds = JSON.stringify(
      Array.isArray(body.songIds) ? body.songIds.filter((v) => typeof v === 'string') : [],
    );

    const kind = body.kind === 'missa' ? 'missa' : 'lista';
    const sections = kind === 'missa' ? JSON.stringify(sanitizeSections(body.sections)) : null;
    const shared = body.shared === true ? 1 : 0;

    // Nasce no topo (maior `position` do usuário); editar não move na lista —
    // só o arrastar-e-soltar da listagem (`_reorder`) muda isso depois.
    // `user_id` entra também no UPDATE do conflito: sem isso, conhecer o id de
    // uma playlist alheia bastaria para sobrescrevê-la.
    const result = await env.DB.prepare(
      `INSERT INTO playlists (id, user_id, name, song_ids, kind, sections, shared, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?,
         (SELECT COALESCE(MAX(position), 0) + 1 FROM playlists WHERE user_id = ?),
         COALESCE(?, datetime('now')), datetime('now'))
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         song_ids = excluded.song_ids,
         kind = excluded.kind,
         sections = excluded.sections,
         shared = excluded.shared,
         updated_at = datetime('now')
       WHERE playlists.user_id = excluded.user_id`,
    )
      .bind(
        id,
        user.id,
        name,
        songIds,
        kind,
        sections,
        shared,
        user.id,
        typeof body.createdAt === 'string' ? body.createdAt : null,
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
      .bind(id, user.id)
      .run();
    return json({ ok: true });
  }

  return methodNotAllowed();
}
