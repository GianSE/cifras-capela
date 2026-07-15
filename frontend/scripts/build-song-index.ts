/**
 * Gera o índice de busca (`public/songs/index.json`) escaneando todos os
 * arquivos de música em `public/songs/**`.
 *
 * Suporta os dois formatos de metadados:
 *  - Frontmatter YAML (`---` no topo do arquivo) — formato preferido.
 *  - Diretivas ChordPro (`{title: ...}`) — compatibilidade retroativa.
 *
 * Extração leve por regex (sem parse completo) — o índice precisa apenas dos
 * metadados para busca/filtragem.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SongIndexEntry } from '../src/types/library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SONGS_DIR = path.resolve(__dirname, '../public/songs');
const OUTPUT_FILE = path.resolve(SONGS_DIR, 'index.json');

/** Diretivas ChordPro `{name: value}` de metadados. */
const DIRECTIVE_REGEX = /\{(title|t|artist|key|category|categories|tag|tags|language|tempo|bpm):\s*(.+?)\}/gi;

/** Divide uma string tipo `culto, santa ceia` ou `[a, b]` numa lista. */
function toList(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

interface MutableEntry {
  id?: string;
  title?: string;
  artist?: string;
  key?: string;
  categories: string[];
  tags: string[];
  language?: string;
  tempo?: number;
  filename: string;
}

/** Aplica um par chave/valor de metadado à entrada acumulada. */
function applyMeta(entry: MutableEntry, rawKey: string, rawValue: string): void {
  const key = rawKey.toLowerCase();
  const value = rawValue.trim();
  if (!value) return;

  switch (key) {
    case 'title':
    case 't':
      entry.title = value;
      break;
    case 'artist':
      entry.artist = value;
      break;
    case 'key':
      entry.key = value;
      break;
    case 'category':
    case 'categories':
      entry.categories.push(...toList(value));
      break;
    case 'tag':
    case 'tags':
      entry.tags.push(...toList(value));
      break;
    case 'language':
    case 'lang':
      entry.language = value;
      break;
    case 'tempo':
    case 'bpm': {
      const n = Number.parseInt(value, 10);
      if (!Number.isNaN(n)) entry.tempo = n;
      break;
    }
  }
}

/** Extrai o bloco de frontmatter YAML (`---\n...\n---`) se presente. */
function extractFrontmatter(content: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  return match ? match[1]! : null;
}

/**
 * Extrai a letra em texto puro para indexação da busca: remove o frontmatter,
 * as diretivas `{...}` e os acordes `[...]`, colapsando espaços.
 */
function extractLyrics(content: string): string {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  return body
    .replace(/\{[^}]*\}/g, ' ') // diretivas / seções
    .replace(/\[[^\]]*\]/g, '') // acordes
    .replace(/^#.*$/gm, ' ') // comentários
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMetadata(content: string, filename: string): MutableEntry {
  const entry: MutableEntry = { categories: [], tags: [], filename };

  const frontmatter = extractFrontmatter(content);
  if (frontmatter) {
    for (const line of frontmatter.split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      applyMeta(entry, line.slice(0, colon), line.slice(colon + 1));
    }
  }

  // Diretivas ChordPro (no corpo ou em arquivos legados).
  let match: RegExpExecArray | null;
  while ((match = DIRECTIVE_REGEX.exec(content)) !== null) {
    applyMeta(entry, match[1] ?? '', match[2] ?? '');
  }

  return entry;
}

async function scanDirectory(dir: string, baseDir: string): Promise<SongIndexEntry[]> {
  const entries: SongIndexEntry[] = [];

  try {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      if (file.isDirectory()) {
        entries.push(...(await scanDirectory(fullPath, baseDir)));
        continue;
      }

      if (!/\.(cho|chordpro|chopro)$/i.test(file.name)) continue;

      const content = await fs.readFile(fullPath, 'utf-8');
      const meta = parseMetadata(content, file.name);

      const relativePath = path.relative(baseDir, fullPath);
      const parsed = path.parse(relativePath);
      const id = path.posix.join(parsed.dir.split(path.sep).join('/'), parsed.name);
      const title = meta.title ?? parsed.name.replace(/-/g, ' ');

      const entry: SongIndexEntry = {
        id,
        title,
        filename: file.name,
        ...(meta.artist && { artist: meta.artist }),
        ...(meta.key && { key: meta.key }),
        ...(meta.categories.length > 0 && { categories: dedupe(meta.categories) }),
        ...(meta.tags.length > 0 && { tags: dedupe(meta.tags) }),
        ...(meta.language && { language: meta.language }),
        ...(meta.tempo !== undefined && { tempo: meta.tempo }),
        ...(() => {
          const lyrics = extractLyrics(content);
          return lyrics ? { lyrics } : {};
        })(),
      };

      entries.push(entry);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`Diretório ${dir} não encontrado. Ignorando.`);
    } else {
      throw err;
    }
  }

  return entries;
}

function dedupe(list: readonly string[]): string[] {
  return [...new Set(list.map((s) => s.toLowerCase()))];
}

async function buildIndex(): Promise<void> {
  console.log('Gerando índice de músicas...');
  try {
    const index = await scanDirectory(SONGS_DIR, SONGS_DIR);
    index.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(index, null, 2));
    console.log(`Índice gerado com ${index.length} música(s) em ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Falha ao gerar o índice de músicas:', err);
    process.exit(1);
  }
}

void buildIndex();
