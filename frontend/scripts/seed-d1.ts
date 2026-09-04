/**
 * Gera o SQL que carrega no D1 as músicas versionadas em `public/songs/`.
 *
 * Os metadados são derivados do próprio `.cho` pelo mesmo parser do app, então
 * o banco nasce consistente com o que a tela mostraria.
 *
 *   npx tsx scripts/seed-d1.ts > ../worker/seed.sql
 *   cd ../worker && npx wrangler d1 execute cifras-db --remote --file seed.sql
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { parse } from '../src/lib/parser';
import { deriveIndexEntry } from '../src/lib/library/derive';

const ROOT = join(import.meta.dirname, '..', 'public', 'songs');

/** Todos os `.cho` sob `public/songs`, em qualquer subpasta. */
async function findSongs(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) found.push(...(await findSongs(full)));
    else if (item.name.endsWith('.cho')) found.push(full);
  }
  return found;
}

/** Aspas simples dobradas — é assim que o SQLite escapa dentro de string. */
const q = (v: string | null): string => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null | undefined): string => (v === null || v === undefined ? 'NULL' : String(v));

const files = await findSongs(ROOT);

for (const file of files) {
  // `culto/maos-ao-alto.cho` → `culto/maos-ao-alto`
  const id = relative(ROOT, file).split(sep).join('/').replace(/\.cho$/, '');
  const source = await readFile(file, 'utf8');
  const { song } = parse(source);
  const entry = deriveIndexEntry(id, source, song);

  console.log(
    `INSERT INTO songs (id, title, artist, song_key, tempo, capo, categories, tags, language, lyrics, source)\n` +
      `VALUES (${q(id)}, ${q(entry.title)}, ${q(entry.artist ?? null)}, ${q(entry.key ?? null)}, ` +
      `${n(entry.tempo)}, ${n(song.metadata.capo)}, ${q(JSON.stringify(entry.categories ?? []))}, ` +
      `${q(JSON.stringify(entry.tags ?? []))}, ${q(entry.language ?? null)}, ${q(entry.lyrics ?? null)}, ${q(source)})\n` +
      `ON CONFLICT (id) DO UPDATE SET title = excluded.title, artist = excluded.artist, ` +
      `song_key = excluded.song_key, tempo = excluded.tempo, capo = excluded.capo, ` +
      `categories = excluded.categories, tags = excluded.tags, language = excluded.language, ` +
      `lyrics = excluded.lyrics, source = excluded.source, updated_at = datetime('now');`,
  );
}

console.error(`${files.length} músicas convertidas.`);
