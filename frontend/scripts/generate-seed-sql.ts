/**
 * Gera `supabase/seed.sql` a partir dos arquivos `.cho` de `public/songs/`.
 *
 *   npm run seed:sql --workspace=frontend
 *
 * Depois é só colar o arquivo gerado no **SQL Editor** do Supabase e executar.
 *
 * Por que SQL em vez de subir direto pela API? Porque as políticas de RLS só
 * liberam escrita para usuários autenticados, e um script não tem sessão —
 * seria preciso a `service_role` key (secreta). No SQL Editor você já está
 * autenticado como dono do projeto, então nenhum segredo precisa sair do
 * painel. Como é um bootstrap de uma vez só, é o caminho mais simples.
 *
 * O comando é idempotente: usa upsert (`on conflict do update`).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = path.resolve(__dirname, '../public/songs');
const OUTPUT = path.resolve(__dirname, '../../supabase/seed.sql');

/** Escapa um literal de texto SQL (aspas simples viram duplas). */
function sqlText(value: string | null): string {
  if (value === null || value === '') return 'null';
  return `'${value.replace(/'/g, "''")}'`;
}

/** Escapa um array de texto SQL. */
function sqlArray(values: string[]): string {
  if (values.length === 0) return `'{}'::text[]`;
  return `array[${values.map((v) => sqlText(v)).join(', ')}]::text[]`;
}

function sqlNumber(value: string | undefined): string {
  if (!value) return 'null';
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? 'null' : String(n);
}

/** Frontmatter + diretivas → metadados. */
function extractMeta(content: string): Record<string, string> {
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

  const directive =
    /\{(title|artist|key|category|categories|tag|tags|language|tempo|bpm|capo):\s*(.+?)\}/gi;
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

async function generate(): Promise<void> {
  const files = (await findChoFiles(SONGS_DIR)).sort();

  const values = await Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(file, 'utf-8');
      const meta = extractMeta(source);

      const relative = path.relative(SONGS_DIR, file);
      const parsed = path.parse(relative);
      const id = path.posix.join(parsed.dir.split(path.sep).join('/'), parsed.name);

      const cols = [
        sqlText(id),
        sqlText(meta['title'] ?? parsed.name.replace(/-/g, ' ')),
        sqlText(meta['artist'] ?? null),
        sqlText(meta['key'] ?? null),
        sqlNumber(meta['tempo'] ?? meta['bpm']),
        sqlNumber(meta['capo']),
        sqlArray(toList(meta['categories'] ?? meta['category'])),
        sqlArray(toList(meta['tags'] ?? meta['tag'])),
        sqlText(meta['language'] ?? meta['lang'] ?? null),
        sqlText(extractLyrics(source) || null),
        sqlText(source),
      ];

      return `  (${cols.join(', ')})`;
    }),
  );

  const sql = `-- =============================================================================
-- Seed gerado automaticamente a partir de frontend/public/songs/*.cho
-- NÃO edite à mão: rode \`npm run seed:sql --workspace=frontend\`
--
-- Cole este arquivo no SQL Editor do Supabase e execute.
-- É idempotente: rodar de novo apenas atualiza as músicas existentes.
-- =============================================================================

insert into public.songs
  (id, title, artist, song_key, tempo, capo, categories, tags, language, lyrics, source)
values
${values.join(',\n')}
on conflict (id) do update set
  title      = excluded.title,
  artist     = excluded.artist,
  song_key   = excluded.song_key,
  tempo      = excluded.tempo,
  capo       = excluded.capo,
  categories = excluded.categories,
  tags       = excluded.tags,
  language   = excluded.language,
  lyrics     = excluded.lyrics,
  source     = excluded.source;
`;

  await fs.writeFile(OUTPUT, sql, 'utf-8');
  console.log(`✓ ${files.length} música(s) → ${OUTPUT}`);
  for (const file of files) console.log(`   • ${path.relative(SONGS_DIR, file)}`);
  console.log('\nAgora cole o conteúdo de supabase/seed.sql no SQL Editor do Supabase.');
}

void generate();
