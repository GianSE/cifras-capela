/**
 * Sobe os arquivos `.cho` de `public/songs/` para o Supabase.
 *
 * Uso (uma vez, depois de rodar `supabase/schema.sql`):
 *
 *   # .env.local precisa ter VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   npm run seed --workspace=frontend
 *
 * Usa a **service role key** (não a anon), porque as políticas de RLS só
 * liberam escrita para usuários autenticados — e um script não tem sessão.
 * Essa chave é secreta: nunca a coloque em variáveis `VITE_*`, que vão para
 * o bundle do navegador.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = path.resolve(__dirname, '../public/songs');

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Faltam variáveis de ambiente.\n' +
      '  VITE_SUPABASE_URL=...\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=...   (Project Settings → API → service_role)\n\n' +
      'Coloque-as em frontend/.env.local e rode de novo.',
  );
  process.exit(1);
}

/** Frontmatter + diretivas → metadados (mesma heurística do build do índice). */
function extractMeta(content: string) {
  const meta: Record<string, string> = {};
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);

  if (fm?.[1]) {
    for (const line of fm[1].split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (value) meta[key] = value;
    }
  }

  const directive = /\{(title|artist|key|category|categories|tag|tags|language|tempo|bpm):\s*(.+?)\}/gi;
  let match: RegExpExecArray | null;
  while ((match = directive.exec(content)) !== null) {
    const key = (match[1] ?? '').toLowerCase();
    if (!meta[key] && match[2]) meta[key] = match[2].trim();
  }

  return meta;
}

function toList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function extractLyrics(content: string): string {
  return content
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/^#.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findChoFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findChoFiles(full)));
    else if (/\.(cho|chordpro|chopro)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

async function seed(): Promise<void> {
  const supabase = createClient(url!, serviceKey!, {
    auth: { persistSession: false },
  });

  const files = await findChoFiles(SONGS_DIR);
  console.log(`Encontrados ${files.length} arquivo(s) .cho`);

  const rows = await Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(file, 'utf-8');
      const meta = extractMeta(source);

      const relative = path.relative(SONGS_DIR, file);
      const parsed = path.parse(relative);
      const id = path.posix.join(parsed.dir.split(path.sep).join('/'), parsed.name);

      const tempo = meta['tempo'] ?? meta['bpm'];
      const capo = meta['capo'];

      return {
        id,
        title: meta['title'] ?? parsed.name.replace(/-/g, ' '),
        artist: meta['artist'] ?? null,
        song_key: meta['key'] ?? null,
        tempo: tempo ? Number.parseInt(tempo, 10) : null,
        capo: capo ? Number.parseInt(capo, 10) : null,
        categories: toList(meta['categories'] ?? meta['category']),
        tags: toList(meta['tags'] ?? meta['tag']),
        language: meta['language'] ?? meta['lang'] ?? null,
        lyrics: extractLyrics(source) || null,
        source,
      };
    }),
  );

  const { error } = await supabase.from('songs').upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Falha ao subir as músicas:', error.message);
    process.exit(1);
  }

  console.log(`✓ ${rows.length} música(s) enviada(s) para o Supabase:`);
  for (const row of rows) console.log(`   • ${row.id} — ${row.title}`);
}

void seed();
