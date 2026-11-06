import { useDeferredValue, useMemo } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { findDuplicates, type DuplicateMatch } from '@/lib/library/duplicates';
import type { SongIndexEntry } from '@/types/library';

/** Mais que isso vira uma lista que ninguém lê (os mais prováveis vêm primeiro). */
const MAX_SHOWN = 3;

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
  // Compara a biblioteca inteira: não pode travar a digitação.
  const deferredTitle = useDeferredValue(title);
  const deferredLyrics = useDeferredValue(lyrics);
  const matches = useMemo(
    () => findDuplicates({ title: deferredTitle, lyrics: deferredLyrics }, songs),
    [deferredTitle, deferredLyrics, songs],
  );

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
