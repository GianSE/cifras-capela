/**
 * @module services/worker-repository
 * @description Biblioteca servida pelo próprio Worker (D1), com CRUD real.
 *
 * Substituiu o Supabase, cujo projeto foi apagado e levou a biblioteca junto.
 * Aqui não há serviço externo: a API vive na mesma origem do site.
 *
 * Leitura tem três níveis, nesta ordem:
 *   1. `/api/songs` — o banco, sempre que houver rede;
 *   2. cache local — última cópia bem-sucedida, com os `.cho` inteiros;
 *   3. `.cho` do Git — o que vem junto com o app.
 *
 * O terceiro nível é o que garante que a biblioteca nunca apareça vazia, nem
 * para quem abre o site pela primeira vez com o banco fora do ar.
 */

import type { SongIndexEntry } from '@/types/library';
import { deriveIndexEntry } from '@/lib/library/derive';
import { parse } from '@/lib/parser';
import { staticRepository } from './static-repository';
import type { LibraryLoad, SaveSongInput, SongRepository } from './song-repository';

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

/** Mensagem do corpo da resposta, quando houver. */
async function errorFrom(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) return 'Sua sessão expirou. Entre novamente para salvar.';
  return body.error ?? fallback;
}

class WorkerSongRepository implements SongRepository {
  readonly canWrite = true;

  async listSongs(): Promise<LibraryLoad> {
    try {
      const res = await fetch('/api/songs', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as {
        entries: SongIndexEntry[];
        sources: Record<string, string>;
      };

      writeCache({
        entries: data.entries,
        sources: data.sources ?? {},
        cachedAt: new Date().toISOString(),
      });

      return { entries: data.entries, source: 'network', fromCache: false };
    } catch (err) {
      const cache = readCache();
      if (cache) {
        console.warn('Sem conexão com a API — usando a biblioteca em cache.', err);
        return {
          entries: cache.entries,
          source: 'cache',
          fromCache: true,
          cachedAt: cache.cachedAt,
        };
      }

      // Último recurso: as músicas versionadas, que vêm com o app. Se nem
      // isso responder, aí sim propaga — não há mais de onde tirar.
      console.warn('Sem cache local — caindo nas músicas versionadas.', err);
      const fallback = await staticRepository.listSongs();
      return { entries: fallback.entries, source: 'static', fromCache: true };
    }
  }

  async getSource(id: string): Promise<string> {
    try {
      const res = await fetch(`/api/songs/${id}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { source: string };
      return data.source;
    } catch (err) {
      const cached = readCache()?.sources[id];
      if (cached) return cached;
      // Pode ser uma das músicas que vêm com o app.
      return staticRepository.getSource(id).catch(() => {
        throw err instanceof Error ? err : new Error(`Não foi possível carregar "${id}".`);
      });
    }
  }

  /**
   * Cria ou atualiza a música (upsert pelo id).
   * Os metadados são sempre **derivados** do `.cho`, nunca informados à parte:
   * o arquivo é a fonte da verdade, o resto existe para listar e buscar.
   */
  async saveSong({ id, source }: SaveSongInput): Promise<void> {
    const { song } = parse(source);
    const entry = deriveIndexEntry(id, source, song);

    const res = await fetch(`/api/songs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        source,
        title: entry.title,
        artist: entry.artist ?? null,
        key: entry.key ?? null,
        tempo: entry.tempo ?? null,
        capo: song.metadata.capo ?? null,
        categories: [...(entry.categories ?? [])],
        tags: [...(entry.tags ?? [])],
        language: entry.language ?? null,
        lyrics: entry.lyrics ?? null,
      }),
    }).catch(() => null);

    if (!res) throw new Error('Sem conexão. Salvar exige internet.');
    if (!res.ok) throw new Error(await errorFrom(res, 'Não foi possível salvar.'));
  }

  async deleteSong(id: string): Promise<void> {
    const res = await fetch(`/api/songs/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => null);

    if (!res) throw new Error('Sem conexão. Excluir exige internet.');
    if (!res.ok) throw new Error(await errorFrom(res, 'Não foi possível excluir.'));
  }
}

export const workerRepository = new WorkerSongRepository();
