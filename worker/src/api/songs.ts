/**
 * Biblioteca de músicas no D1.
 *
 * Ler é público (o acervo é da comunidade); criar, editar e excluir exigem
 * sessão. A fonte da verdade é sempre o `.cho` em `source` — os metadados são
 * derivados dele no cliente, que já tem o parser, e gravados junto só para a
 * listagem e a busca não precisarem abrir 23 arquivos.
 */

import type { Env, SongRow } from '../types';
import { json, readJson, methodNotAllowed, unauthorized } from '../lib/http';
import { currentUser } from '../lib/session';

/** Entrada do índice, no mesmo formato que o app já consumia. */
interface SongEntry {
  id: string;
  title: string;
  filename: string;
  artist?: string;
  key?: string;
  categories?: string[];
  tags?: string[];
  language?: string;
  tempo?: number;
  capo?: number;
  lyrics?: string;
}

/** JSON guardado em TEXT → array. Nunca lança: dado torto vira lista vazia. */
function parseList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function rowToEntry(row: SongRow): SongEntry {
  const categories = parseList(row.categories);
  const tags = parseList(row.tags);
  return {
    id: row.id,
    title: row.title,
    filename: `${row.id.split('/').pop() ?? row.id}.cho`,
    ...(row.artist && { artist: row.artist }),
    ...(row.song_key && { key: row.song_key }),
    ...(categories.length > 0 && { categories }),
    ...(tags.length > 0 && { tags }),
    ...(row.language && { language: row.language }),
    ...(row.tempo !== null && { tempo: row.tempo }),
    ...(row.capo !== null && { capo: row.capo }),
    ...(row.lyrics && { lyrics: row.lyrics }),
  };
}

/** `GET /api/songs` — índice completo, em ordem alfabética. */
export async function listSongs(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM songs ORDER BY title COLLATE NOCASE ASC`,
  ).all<SongRow>();

  const rows = results ?? [];
  // Manda as cifras junto: o app guarda tudo no cache offline de uma vez, e
  // 23 arquivos pequenos numa resposta custam menos que 23 idas ao servidor.
  const sources: Record<string, string> = {};
  for (const row of rows) sources[row.id] = row.source;

  return json({ entries: rows.map(rowToEntry), sources });
}

/** `GET /api/songs/<id>` — só o `.cho`. */
export async function getSong(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT source FROM songs WHERE id = ?`)
    .bind(id)
    .first<{ source: string }>();

  if (!row) return json({ error: 'Música não encontrada.' }, 404);
  return json({ source: row.source });
}

interface SaveBody {
  source: string;
  title: string;
  artist: string | null;
  key: string | null;
  tempo: number | null;
  capo: number | null;
  categories: string[];
  tags: string[];
  language: string | null;
  lyrics: string | null;
}

/** `PUT /api/songs/<id>` — cria ou atualiza (upsert pelo id). */
export async function saveSong(request: Request, env: Env, id: string): Promise<Response> {
  const user = await currentUser(request, env.JWT_SECRET);
  if (!user) return unauthorized();

  const body = await readJson<SaveBody>(request);
  const source = typeof body.source === 'string' ? body.source : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!source.trim()) return json({ error: 'A cifra está vazia.' }, 400);
  if (!title) return json({ error: 'A música precisa de um título.' }, 400);

  const list = (v: unknown): string =>
    JSON.stringify(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const nullableText = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null;
  const nullableInt = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;

  await env.DB.prepare(
    `INSERT INTO songs
       (id, title, artist, song_key, tempo, capo, categories, tags, language, lyrics, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (id) DO UPDATE SET
       title = excluded.title,
       artist = excluded.artist,
       song_key = excluded.song_key,
       tempo = excluded.tempo,
       capo = excluded.capo,
       categories = excluded.categories,
       tags = excluded.tags,
       language = excluded.language,
       lyrics = excluded.lyrics,
       source = excluded.source,
       updated_at = datetime('now')`,
  )
    .bind(
      id,
      title,
      nullableText(body.artist),
      nullableText(body.key),
      nullableInt(body.tempo),
      nullableInt(body.capo),
      list(body.categories),
      list(body.tags),
      nullableText(body.language),
      nullableText(body.lyrics),
      source,
    )
    .run();

  return json({ ok: true, id });
}

/** `DELETE /api/songs/<id>` */
export async function deleteSong(request: Request, env: Env, id: string): Promise<Response> {
  const user = await currentUser(request, env.JWT_SECRET);
  if (!user) return unauthorized();

  await env.DB.prepare(`DELETE FROM songs WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

/** Roteia `/api/songs` e `/api/songs/<id>` (o id contém barras). */
export async function songsRoute(request: Request, env: Env, pathname: string): Promise<Response> {
  const rest = pathname.slice('/api/songs'.length).replace(/^\//, '');
  const id = decodeURIComponent(rest);

  if (!id) {
    if (request.method === 'GET') return listSongs(env);
    return methodNotAllowed();
  }

  switch (request.method) {
    case 'GET':
      return getSong(env, id);
    case 'PUT':
      return saveSong(request, env, id);
    case 'DELETE':
      return deleteSong(request, env, id);
    default:
      return methodNotAllowed();
  }
}
