/**
 * @module lib/library/audit
 * @description Agrupa a biblioteca em possíveis duplicatas (título idêntico ou
 * letra parecida) e sinaliza músicas que parecem estar em espanhol — para a
 * página de auditoria limpar o acervo depois do import em massa.
 *
 * Tudo aqui roda uma vez, sob pedido (botão), nunca durante a navegação
 * normal: comparar 16 mil músicas par a par seria lento demais, então a
 * busca por letra parecida usa um índice de "shingles" (trincas de palavras)
 * para só comparar pares que já têm algo em comum.
 */

import { normalizeTitle, shingles, lyricsAreSimilar, SHINGLE_MIN } from './duplicates';
import type { SongWithLyrics } from '@/types/library';

export interface AuditGroup {
  readonly key: string;
  readonly songs: readonly SongWithLyrics[];
  /** Índice, dentro de `songs`, da versão sugerida para manter. */
  readonly suggestedKeepIndex: number;
}

/** Quanto maior, mais "completa" parece a versão — decide qual sugerir manter. */
function completeness(song: SongWithLyrics): number {
  return (
    (song.lyrics?.length ?? 0) +
    (song.key ? 80 : 0) +
    (song.youtube ? 40 : 0) +
    (song.artist ? 20 : 0) +
    (song.tags?.length ?? 0) * 5
  );
}

function suggestKeepIndex(songs: readonly SongWithLyrics[]): number {
  let best = 0;
  for (let i = 1; i < songs.length; i++) {
    if (completeness(songs[i]!) > completeness(songs[best]!)) best = i;
  }
  return best;
}

/** Letra muito curta não permite julgar nada — e textos litúrgicos fixos
 * (refrão de "Santo", "Amém"…) são curtos, exatamente para não entrar aqui. */
const MIN_LYRICS_CHARS = 80;
/** Uma trinca que aparece em muitas músicas é fórmula comum, não "a mesma letra". */
const MAX_SHINGLE_FANOUT = 40;
/** Grupo grande demais não tem "um culpado" óbvio — melhor a pessoa olhar com calma. */
export const LARGE_GROUP_THRESHOLD = 10;

/** Títulos iguais (ignorando acento, maiúscula e "(Ao vivo)"/artista depois do "-"). */
export function groupByExactTitle(songs: readonly SongWithLyrics[]): AuditGroup[] {
  const byTitle = new Map<string, SongWithLyrics[]>();
  for (const song of songs) {
    const key = normalizeTitle(song.title);
    if (!key) continue;
    const list = byTitle.get(key);
    if (list) list.push(song);
    else byTitle.set(key, [song]);
  }
  return [...byTitle.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, songs: list, suggestedKeepIndex: suggestKeepIndex(list) }))
    .sort((a, b) => b.songs.length - a.songs.length);
}

/** Pai de cada id no union-find — junta quem a letra aproxima, mesmo em cadeia. */
class UnionFind {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    const p = this.parent.get(x) ?? x;
    if (p === x) {
      this.parent.set(x, x);
      return x;
    }
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Letra muito parecida, mesmo com título diferente. Usa as trincas de
 * palavras como índice: só compara músicas que já compartilham uma trinca,
 * em vez de todas contra todas.
 */
export function groupBySimilarLyrics(songs: readonly SongWithLyrics[]): AuditGroup[] {
  const shinglesById = new Map<string, Set<string>>();
  const invertedIndex = new Map<string, string[]>();

  for (const song of songs) {
    if ((song.lyrics?.length ?? 0) < MIN_LYRICS_CHARS) continue;
    const set = shingles(song.lyrics!);
    if (set.size < SHINGLE_MIN) continue;
    shinglesById.set(song.id, set);
    for (const shingle of set) {
      const ids = invertedIndex.get(shingle);
      if (ids) ids.push(song.id);
      else invertedIndex.set(shingle, [song.id]);
    }
  }

  const uf = new UnionFind();
  const checked = new Set<string>();
  for (const ids of invertedIndex.values()) {
    if (ids.length < 2 || ids.length > MAX_SHINGLE_FANOUT) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);
        if (lyricsAreSimilar(shinglesById.get(a)!, shinglesById.get(b)!)) uf.union(a, b);
      }
    }
  }

  const byId = new Map(songs.map((s) => [s.id, s] as const));
  const byRoot = new Map<string, string[]>();
  for (const id of shinglesById.keys()) {
    const root = uf.find(id);
    const list = byRoot.get(root);
    if (list) list.push(id);
    else byRoot.set(root, [id]);
  }

  return [...byRoot.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => {
      const list = ids.map((id) => byId.get(id)!);
      return {
        key,
        songs: list,
        // Grupo grande: sem "melhor" óbvia, a pessoa escolhe olhando com calma.
        suggestedKeepIndex: list.length > LARGE_GROUP_THRESHOLD ? -1 : suggestKeepIndex(list),
      };
    })
    .sort((a, b) => b.songs.length - a.songs.length);
}

/** Palavras e marcas que o português não usa (ou usa muito raramente). */
const SPANISH_WORDS = [
  'señor', 'señora', 'iglesia', 'nuestro', 'nuestra', 'vosotros', 'está', 'así',
  'cómo', 'dónde', 'porqué', 'gracias', 'corazón', 'oración', 'comunión', 'canción',
  'adoración', 'jesús', 'según', 'cuándo', 'contigo', 'solamente', 'siempre', 'mientras',
];

function spanishScore(text: string): number {
  let score = 0;
  if (/[ñ¿¡]/.test(text)) score += 3;
  if (/\b\p{L}+(ción|sión)\b/giu.test(text)) score += 2;
  const lower = text.toLowerCase();
  for (const word of SPANISH_WORDS) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) score += 1;
  }
  return score;
}

/** Acima disso, vale a pena a pessoa conferir — não é certeza, é indício. */
const SPANISH_THRESHOLD = 3;

export interface SpanishFlag {
  readonly song: SongWithLyrics;
  readonly score: number;
}

export function findPossibleSpanish(songs: readonly SongWithLyrics[]): SpanishFlag[] {
  return songs
    .map((song) => ({ song, score: spanishScore(`${song.title} ${song.lyrics ?? ''}`) }))
    .filter((flag) => flag.score >= SPANISH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}
