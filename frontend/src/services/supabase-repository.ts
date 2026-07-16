/**
 * @module services/supabase-repository
 * @description Biblioteca com CRUD real, sincronizada entre dispositivos.
 *
 * Estratégia offline: toda leitura bem-sucedida alimenta um cache em
 * localStorage. Sem internet, a biblioteca inteira continua legível a partir
 * dele — o que importa no palco. Escrever exige conexão (e login).
 */

import { supabase } from '@/lib/supabase/client';
import type { SongRow } from '@/lib/supabase/types';
import type { SongIndexEntry } from '@/types/library';
import { deriveIndexEntry } from '@/lib/library/derive';
import { parse } from '@/lib/parser';
import type { SaveSongInput, SongRepository } from './song-repository';

const CACHE_KEY = 'cifras-capela:songs-cache';

interface CacheShape {
  /** Metadados de todas as músicas. */
  readonly entries: SongIndexEntry[];
  /** `.cho` por id, para o leitor funcionar offline. */
  readonly sources: Record<string, string>;
  readonly cachedAt: string;
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheShape) : null;
  } catch {
    return null;
  }
}

function writeCache(cache: CacheShape): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Não foi possível cachear a biblioteca localmente', e);
  }
}

/** Converte a linha do banco na entrada usada pela biblioteca. */
function rowToEntry(row: SongRow): SongIndexEntry {
  return {
    id: row.id,
    title: row.title,
    filename: `${row.id.split('/').pop() ?? row.id}.cho`,
    ...(row.artist && { artist: row.artist }),
    ...(row.song_key && { key: row.song_key }),
    ...(row.categories.length > 0 && { categories: row.categories }),
    ...(row.tags.length > 0 && { tags: row.tags }),
    ...(row.language && { language: row.language }),
    ...(row.tempo !== null && { tempo: row.tempo }),
    ...(row.lyrics && { lyrics: row.lyrics }),
  };
}

function requireClient() {
  if (!supabase) throw new Error('Supabase não está configurado.');
  return supabase;
}

class SupabaseSongRepository implements SongRepository {
  readonly canWrite = true;

  async listSongs(): Promise<SongIndexEntry[]> {
    try {
      const { data, error } = await requireClient()
        .from('songs')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;

      const rows = data ?? [];
      const entries = rows.map(rowToEntry);

      // Alimenta o cache offline com metadados + cifras.
      const sources: Record<string, string> = {};
      for (const row of rows) sources[row.id] = row.source;
      writeCache({ entries, sources, cachedAt: new Date().toISOString() });

      return entries;
    } catch (err) {
      const cache = readCache();
      if (cache) {
        console.warn('Sem conexão com o Supabase — usando a biblioteca em cache.', err);
        return cache.entries;
      }
      console.error('Erro ao carregar a biblioteca:', err);
      return [];
    }
  }

  async getSource(id: string): Promise<string> {
    try {
      const { data, error } = await requireClient()
        .from('songs')
        .select('source')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Música não encontrada.');
      return data.source;
    } catch (err) {
      const cached = readCache()?.sources[id];
      if (cached) return cached;
      throw err instanceof Error ? err : new Error(`Não foi possível carregar "${id}".`);
    }
  }

  /**
   * Cria ou atualiza a música (upsert pelo id).
   * Os metadados são sempre **derivados** do `.cho`, nunca informados à parte.
   */
  async saveSong({ id, source }: SaveSongInput): Promise<void> {
    const { song } = parse(source);
    const entry = deriveIndexEntry(id, source, song);

    const { error } = await requireClient().from('songs').upsert(
      {
        id,
        source,
        title: entry.title,
        artist: entry.artist ?? null,
        song_key: entry.key ?? null,
        tempo: entry.tempo ?? null,
        capo: song.metadata.capo ?? null,
        categories: [...(entry.categories ?? [])],
        tags: [...(entry.tags ?? [])],
        language: entry.language ?? null,
        lyrics: entry.lyrics ?? null,
      },
      { onConflict: 'id' },
    );

    if (error) throw new Error(traduzirErro(error.message));
  }

  async deleteSong(id: string): Promise<void> {
    const { error } = await requireClient().from('songs').delete().eq('id', id);
    if (error) throw new Error(traduzirErro(error.message));
  }
}

/** Deixa os erros mais comuns compreensíveis para quem está usando o app. */
function traduzirErro(message: string): string {
  if (/row-level security|violates row-level/i.test(message)) {
    return 'Você precisa entrar para salvar músicas.';
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return 'Sem conexão. Salvar exige internet.';
  }
  return message;
}

export const supabaseRepository = new SupabaseSongRepository();
