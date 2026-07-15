/**
 * @module lib/import/json-importer
 * @description Importa músicas a partir de JSON com formas variadas, mapeando
 * campos comuns (title/artist/key/…) e o corpo (body/lyrics/content/…).
 */
import type { ImportedSong } from './types';

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickList(obj: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim()) {
      return v.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return undefined;
}

function pickBody(obj: Record<string, unknown>): string {
  for (const k of ['body', 'chordpro', 'content', 'lyrics', 'text', 'letra', 'cifra']) {
    const v = obj[k];
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(String).join('\n');
  }
  return '';
}

export function importJson(jsonText: string): ImportedSong {
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { body: jsonText, warnings: ['JSON inválido — revise o conteúdo manualmente.'] };
  }

  const obj = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') {
    return { body: jsonText, warnings: ['Estrutura JSON não reconhecida.'] };
  }

  const tempoRaw = obj['tempo'] ?? obj['bpm'];
  const capoRaw = obj['capo'];

  const body = pickBody(obj);
  if (!body) warnings.push('Corpo/letra não encontrado no JSON.');

  return {
    title: pickString(obj, ['title', 'titulo', 'nome', 'name']),
    artist: pickString(obj, ['artist', 'artista', 'author', 'autor', 'interprete']),
    key: pickString(obj, ['key', 'tom', 'tonalidade']),
    categories: pickList(obj, ['categories', 'categorias', 'category', 'categoria']),
    tags: pickList(obj, ['tags', 'etiquetas']),
    language: pickString(obj, ['language', 'lang', 'idioma']),
    tempo: typeof tempoRaw === 'number' ? tempoRaw : undefined,
    capo: typeof capoRaw === 'number' ? capoRaw : undefined,
    body,
    warnings,
  };
}
