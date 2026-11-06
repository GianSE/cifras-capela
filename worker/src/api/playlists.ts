/**
 * Playlists sincronizadas por usuário.
 *
 * O app continua guardando tudo em localStorage — isto aqui é a cópia que
 * permite abrir o mesmo repertório no celular e no PC. Uma playlist é de quem a
 * montou: listar, gravar e excluir exigem sessão e filtram por `user_id`.
 *
 * A exceção é ler **uma** playlist pelo id (`GET /api/playlists/<id>`): quem
 * tem o link a vê, ainda que seja de outra conta — é assim que o grupo que vai
 * tocar junto abre o repertório. Continua exigindo estar logado no site.
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
  created_at: string;
  updated_at: string;
}

function rowToPlaylist(row: PlaylistRow) {
  return {
    id: row.id,
    name: row.name,
    songIds: parseIds(row.song_ids),
    kind: row.kind === 'missa' ? 'missa' : 'lista',
    sections: row.kind === 'missa' ? parseSections(row.sections) : null,
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

  // Leitura de uma playlist: basta ter o link.
  if (id && request.method === 'GET') {
    const row = await env.DB.prepare(
      `SELECT id, user_id, name, song_ids, kind, sections, created_at, updated_at
         FROM playlists WHERE id = ?`,
    )
      .bind(id)
      .first<PlaylistRow>();

    const isOwner = row !== null && row.user_id === user.id;
    if (!row) {
      return json({ error: 'Playlist não encontrada.' }, 404);
    }
    return json(
      { playlist: rowToPlaylist(row), isOwner },
      200,
      // Muda quando o dono reordena: nada de cache no caminho.
      { 'Cache-Control': 'no-store' },
    );
  }

  if (!id) {
    if (request.method !== 'GET') return methodNotAllowed();

    const { results } = await env.DB.prepare(
      `SELECT id, user_id, name, song_ids, kind, sections, created_at, updated_at
         FROM playlists WHERE user_id = ? ORDER BY updated_at DESC`,
    )
      .bind(user.id)
      .all<PlaylistRow>();

    return json({ playlists: (results ?? []).map(rowToPlaylist) });
  }

  if (request.method === 'PUT') {
    const body = await readJson<{
      name: string;
      songIds: string[];
      kind?: string;
      sections?: unknown;
      createdAt: string;
    }>(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return json({ error: 'A playlist precisa de um nome.' }, 400);

    const songIds = JSON.stringify(
      Array.isArray(body.songIds) ? body.songIds.filter((v) => typeof v === 'string') : [],
    );

    const kind = body.kind === 'missa' ? 'missa' : 'lista';
    const sections = kind === 'missa' ? JSON.stringify(sanitizeSections(body.sections)) : null;

    // `user_id` entra também no UPDATE do conflito: sem isso, conhecer o id de
    // uma playlist alheia bastaria para sobrescrevê-la.
    const result = await env.DB.prepare(
      `INSERT INTO playlists (id, user_id, name, song_ids, kind, sections, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         song_ids = excluded.song_ids,
         kind = excluded.kind,
         sections = excluded.sections,
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
