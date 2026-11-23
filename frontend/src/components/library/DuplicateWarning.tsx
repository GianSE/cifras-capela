import { useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import {
  findDuplicates,
  normalizeText,
  normalizeTitle,
  type DuplicateMatch,
} from '@/lib/library/duplicates';
import { songService } from '@/services/song-service';
import type { SongIndexEntry, SongWithLyrics } from '@/types/library';

/** Mais que isso vira uma lista que ninguém lê (os mais prováveis vêm primeiro). */
const MAX_SHOWN = 3;
/** Palavras do rascunho que viram a consulta de letra parecida. */
const PHRASE_WORDS = 6;
/** Teto de candidatos cuja letra vale buscar — o aviso não precisa de mais. */
const MAX_CANDIDATES = 40;
/** Espera o dedo parar: isto vai à rede a cada mudança no rascunho. */
const CHECK_DEBOUNCE_MS = 500;

/**
 * Os candidatos a duplicata e o veredito sobre cada um.
 *
 * Antes isto comparava o rascunho com a biblioteca inteira, que vinha com a
 * letra de todas as músicas no índice. Agora a letra está no servidor, então a
 * conta é feita em dois passos: primeiro se escolhe um punhado de candidatos
 * (título igual, achado aqui mesmo, mais o que o FTS5 apontou por um trecho da
 * letra), depois se busca a letra **só desses** e se compara de verdade.
 *
 * É uma aproximação do que havia antes: uma música de título diferente cujo
 * trecho usado na consulta não casou palavra por palavra pode escapar. O aviso
 * sempre foi um palpite que não impede de salvar, e o preço de acertar 100%
 * era 12MB por abertura do app.
 */
async function findSimilar(
  title: string,
  lyrics: string | undefined,
  songs: readonly SongIndexEntry[],
): Promise<DuplicateMatch[]> {
  const wanted = normalizeTitle(title);
  const byTitle = wanted ? songs.filter((song) => normalizeTitle(song.title) === wanted) : [];

  const phrase = normalizeText(lyrics ?? '').split(' ').filter(Boolean).slice(0, PHRASE_WORDS);
  let byLyrics: SongIndexEntry[] = [];
  if (phrase.length === PHRASE_WORDS) {
    const byId = new Map(songs.map((song) => [song.id, song] as const));
    const ids = await songService.searchIds(phrase.join(' '));
    byLyrics = ids
      .map((id) => byId.get(id))
      .filter((song): song is SongIndexEntry => song !== undefined);
  }

  const candidates = [
    ...new Map([...byTitle, ...byLyrics].map((song) => [song.id, song] as const)).values(),
  ].slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) return [];

  // Sem rede, sobra o que dá para decidir sem letra: o título igual.
  const texts = await songService
    .getLyrics(candidates.filter((song) => song.hasLyrics).map((song) => song.id))
    .catch(() => new Map<string, string>());

  const withLyrics: SongWithLyrics[] = candidates.map((song) => {
    const text = texts.get(song.id);
    return text ? { ...song, lyrics: text } : song;
  });

  return findDuplicates({ title, lyrics }, withLyrics);
}

function reasonOf(match: DuplicateMatch): string {
  if (match.sameTitle && match.similarLyrics) return 'mesmo título e letra';
  return match.similarLyrics ? 'letra parecida' : 'mesmo título';
}

interface DuplicateWarningProps {
  title: string;
  /** Letra em texto puro (sem acordes). */
  lyrics?: string;
  songs: readonly SongIndexEntry[];
}

/**
 * Avisa que a música pode já estar na biblioteca, sem impedir de salvar. O link
 * abre em outra aba para quem está conferindo não perder o que já digitou.
 */
export function DuplicateWarning({ title, lyrics, songs }: DuplicateWarningProps) {
  // Não pode travar a digitação: o texto vem adiado e a conta é assíncrona.
  const deferredTitle = useDeferredValue(title);
  const deferredLyrics = useDeferredValue(lyrics);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);

  useEffect(() => {
    let running = true;
    const timer = setTimeout(() => {
      void findSimilar(deferredTitle, deferredLyrics, songs)
        .then((found) => {
          if (running) setMatches(found);
        })
        .catch(() => {
          if (running) setMatches([]);
        });
    }, CHECK_DEBOUNCE_MS);

    return () => {
      running = false;
      clearTimeout(timer);
    };
  }, [deferredTitle, deferredLyrics, songs]);

  if (matches.length === 0) return null;

  const hidden = matches.length - MAX_SHOWN;

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-sm text-foreground"
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="size-4 shrink-0 text-accent" />
        Essa música pode já estar na biblioteca
      </p>
      <ul className="flex flex-col gap-1.5">
        {matches.slice(0, MAX_SHOWN).map((match) => (
          <li key={match.song.id} className="flex flex-wrap items-center gap-x-2 text-xs">
            <Link
              to={`/musica/${match.song.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              {match.song.title} <ExternalLink className="size-3" />
            </Link>
            <span className="text-muted-foreground">
              {[match.song.artist, match.song.categories?.[0], reasonOf(match)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground">
          E mais {hidden} {hidden === 1 ? 'parecida' : 'parecidas'}.
        </p>
      )}
    </div>
  );
}
