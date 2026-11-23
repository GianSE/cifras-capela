/**
 * Biblioteca de músicas no D1.
 *
 * Tudo exige conta: ler pede sessão (o acervo é fechado, para não publicar
 * cifras de terceiros na internet aberta) e escrever pede administrador.
 * A fonte da verdade é sempre o `.cho` em `source` — os metadados são
 * derivados dele no cliente, que já tem o parser, e gravados junto só para a
 * listagem e a busca não precisarem abrir 23 arquivos.
 */

import type { Env, SongRow } from '../types';
import { json, readJson, methodNotAllowed, unauthorized } from '../lib/http';
import { currentAccount, forbidden } from '../lib/access';

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
  youtube?: string;
  scan?: string;
  /**
   * Se a música tem letra transcrita — só o sim ou não, não o texto.
   *
   * A letra em si saiu do índice (veja `listSongs`), mas a lista precisa saber
   * quais músicas são só foto, sem cifra digitada.
   */
  hasLyrics?: boolean;
}

/** Colunas que a listagem lê — `songs` menos a letra e menos o `.cho`. */
type ListRow = Omit<SongRow, 'lyrics' | 'created_at' | 'updated_at'> & {
  has_lyrics: number;
};

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

/**
 * A folha ligada à música (`scan:` no frontmatter). Vem do próprio `.cho`, que é a
 * fonte da verdade: a lista precisa dela para mostrar quais músicas são só foto.
 */
function scanOf(source: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1];
  return frontmatter
    ? /^scan:[ \t]*(fl_[A-Za-z0-9]+)[ \t]*\r?$/m.exec(frontmatter)?.[1]
    : undefined;
}

function rowToEntry(row: ListRow): SongEntry {
  const scan = scanOf(row.source);
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
    ...(row.youtube && { youtube: row.youtube }),
    ...(scan && { scan }),
    ...(row.has_lyrics === 1 && { hasLyrics: true }),
  };
}

/**
 * `GET /api/songs` — índice completo, em ordem alfabética.
 *
 * Só os metadados: com a biblioteca na faixa de 15 mil músicas, mandar o
 * `.cho` inteiro de cada uma (a coluna `source`) nessa resposta passava de
 * 30MB e travava o carregamento. O `.cho` de cada música só é buscado
 * quando ela é de fato aberta (`GET /api/songs/<id>`).
 *
 * A **letra** também ficou de fora, pelo mesmo motivo numa escala menor: eram
 * 12MB por abertura do app, que nem caberiam na cota do localStorage (o cache
 * offline falhava sem avisar) e cuja reindexação no MiniSearch travava o
 * celular. Quem procura por um trecho de letra agora é o banco, pelo índice
 * FTS5 — veja `searchSongs`.
 */
export async function listSongs(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, title, artist, song_key, tempo, capo, categories, tags, language, youtube,
            (lyrics IS NOT NULL AND lyrics <> '') AS has_lyrics,
            substr(source, 1, 600) AS source
       FROM songs ORDER BY title COLLATE NOCASE ASC`,
  ).all<ListRow>();

  return json({ entries: (results ?? []).map(rowToEntry) });
}

/** Quantos termos de uma busca entram na consulta — o resto é ruído. */
const MAX_TERMS = 12;

/**
 * Expressão de `MATCH` do FTS5 a partir do que a pessoa digitou.
 *
 * Cada termo vai **entre aspas** e com `*` no fim. As aspas fazem `AND`, `OR`,
 * `NOT`, `NEAR`, `:` e `^` entrarem como texto em vez de operador — sem isso,
 * digitar "ou" na busca daria erro de sintaxe (ou pior, mudaria a consulta). O
 * `*` casa por prefixo, como o MiniSearch já fazia no app.
 *
 * Os acentos não são tratados aqui: o `remove_diacritics 2` do índice dobra os
 * dois lados, consulta inclusive.
 */
function matchExpression(query: string): string | null {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0)
    .slice(0, MAX_TERMS);

  if (terms.length === 0) return null;
  return terms.map((term) => `"${term.replaceAll('"', '')}"*`).join(' AND ');
}

/** Teto de resultados: quem procura cifra olha os primeiros, não os 300. */
const SEARCH_LIMIT = 60;

/**
 * `GET /api/songs/busca?q=<texto>` — ids das músicas cujo **título, artista ou
 * letra** casam com o texto, da mais relevante para a menos.
 *
 * Devolve só os ids: o app já tem todo o resto no índice que carregou, e
 * repetir os metadados aqui seria mandar duas vezes a mesma coisa.
 */
export async function searchSongs(env: Env, query: string): Promise<Response> {
  const match = matchExpression(query);
  if (!match) return json({ ids: [] });

  // `songs_fts` entra sem alias porque o `MATCH` do FTS5 só aceita o nome da
  // tabela — com alias, o SQLite responde "no such column".
  const { results } = await env.DB.prepare(
    `SELECT songs.id AS id
       FROM songs_fts JOIN songs ON songs.rowid = songs_fts.rowid
      WHERE songs_fts MATCH ?
      ORDER BY rank
      LIMIT ?`,
  )
    .bind(match, SEARCH_LIMIT)
    .all<{ id: string }>();

  return json({ ids: (results ?? []).map((row) => row.id) });
}

/** Teto de uma página de letras, para a resposta não virar um download. */
const LYRICS_PAGE = 1000;
/** Quantas letras um pedido por ids pode levar de uma vez. */
const MAX_IDS = 200;

/**
 * `GET /api/songs/letras` — a letra em texto puro, sem o `.cho` em volta.
 *
 * Existe porque a letra saiu do índice (`listSongs`) e duas telas ainda
 * precisam dela de verdade, não só para procurar:
 *
 *   - `?ids=a,b,c` → as letras dessas músicas, até 200. É o que o aviso de
 *     "pode já estar na biblioteca" usa, depois de o FTS5 apontar os poucos
 *     candidatos.
 *   - `?depois=<id>&limite=<n>` → varre a biblioteca em páginas, na ordem dos
 *     ids. É a auditoria, que compara letra a letra e roda sob pedido.
 *
 * Pede sessão, como todo o resto — e nada além dela: até agora o índice levava
 * estas mesmas letras para qualquer pessoa logada, então isto não abre nada
 * que já não estivesse aberto.
 */
export async function listLyrics(env: Env, url: URL): Promise<Response> {
  const idsParam = url.searchParams.get('ids');

  if (idsParam !== null) {
    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .slice(0, MAX_IDS);

    if (ids.length === 0) return json({ entries: [] });

    const { results } = await env.DB.prepare(
      `SELECT id, lyrics FROM songs
         WHERE id IN (${ids.map(() => '?').join(',')}) AND lyrics IS NOT NULL`,
    )
      .bind(...ids)
      .all<{ id: string; lyrics: string }>();

    return json({ entries: results ?? [] });
  }

  const after = url.searchParams.get('depois') ?? '';
  const asked = Number(url.searchParams.get('limite'));
  const limit =
    Number.isFinite(asked) && asked > 0 ? Math.min(Math.trunc(asked), LYRICS_PAGE) : LYRICS_PAGE;

  const { results } = await env.DB.prepare(
    `SELECT id, lyrics FROM songs
       WHERE id > ? AND lyrics IS NOT NULL
       ORDER BY id ASC LIMIT ?`,
  )
    .bind(after, limit)
    .all<{ id: string; lyrics: string }>();

  const entries = results ?? [];
  // O cursor é o último id desta página; sem ele, a varredura acabou.
  const next = entries.length === limit ? entries[entries.length - 1]!.id : null;

  return json({ entries, ...(next && { proximo: next }) });
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
  youtube: string | null;
  lyrics: string | null;
}

/** `PUT /api/songs/<id>` — cria ou atualiza (upsert pelo id). */
export async function saveSong(request: Request, env: Env, id: string): Promise<Response> {
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
  // Só aceita um id de vídeo de verdade: o valor vai parar num src de iframe.
  const youtube =
    typeof body.youtube === 'string' && /^[A-Za-z0-9_-]{11}$/.test(body.youtube)
      ? body.youtube
      : null;

  await env.DB.prepare(
    `INSERT INTO songs
       (id, title, artist, song_key, tempo, capo, categories, tags, language, youtube, lyrics, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (id) DO UPDATE SET
       title = excluded.title,
       artist = excluded.artist,
       song_key = excluded.song_key,
       tempo = excluded.tempo,
       capo = excluded.capo,
       categories = excluded.categories,
       tags = excluded.tags,
       language = excluded.language,
       youtube = excluded.youtube,
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
      youtube,
      nullableText(body.lyrics),
      source,
    )
    .run();

  return json({ ok: true, id });
}

/** `DELETE /api/songs/<id>` */
export async function deleteSong(env: Env, id: string): Promise<Response> {
  await env.DB.prepare(`DELETE FROM songs WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

/** Roteia `/api/songs` e `/api/songs/<id>` (o id contém barras). */
export async function songsRoute(request: Request, env: Env, pathname: string): Promise<Response> {
  const account = await currentAccount(request, env);
  if (!account) return unauthorized();

  const rest = pathname.slice('/api/songs'.length).replace(/^\//, '');
  const id = decodeURIComponent(rest);
  const canWrite = account.role === 'admin';

  if (!id) {
    if (request.method === 'GET') return listSongs(env);
    return methodNotAllowed();
  }

  // Estas duas não são música: todo id de verdade traz a pasta (`salmo/...`),
  // então uma palavra sozinha não colide com nenhum.
  if (id === 'busca' || id === 'letras') {
    if (request.method !== 'GET') return methodNotAllowed();
    const url = new URL(request.url);
    return id === 'busca'
      ? searchSongs(env, url.searchParams.get('q') ?? '')
      : listLyrics(env, url);
  }

  switch (request.method) {
    case 'GET':
      return getSong(env, id);
    case 'PUT':
      return canWrite ? saveSong(request, env, id) : forbidden();
    case 'DELETE':
      return canWrite ? deleteSong(env, id) : forbidden();
    default:
      return methodNotAllowed();
  }
}
