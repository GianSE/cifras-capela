import { Link } from 'react-router';
import { Heart, Music4 } from 'lucide-react';
import type { SongIndexEntry } from '@/types/library';
import { useFavorites } from '@/hooks/useFavorites';
import { cn } from '@/lib/utils';

interface SongListItemProps {
  song: SongIndexEntry;
}

/** Linha da lista de músicas: título, artista, tom e favoritar. */
export function SongListItem({ song }: SongListItemProps) {
  const { isFavorite, toggle } = useFavorites();
  const favorite = isFavorite(song.id);

  return (
    <Link
      to={`/musica/${song.id}`}
      className="group flex items-center gap-3 rounded-xl border border-transparent bg-card p-3 transition-colors hover:border-border hover:bg-[var(--color-surface-container-high)]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-container-high)] text-primary">
        <Music4 className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{song.title}</p>
        {song.artist && (
          <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
        )}
      </div>

      {song.key && (
        <span className="shrink-0 rounded-md bg-[var(--color-surface-container-highest)] px-2 py-1 font-mono text-sm font-semibold text-accent">
          {song.key}
        </span>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toggle(song.id);
        }}
        aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        aria-pressed={favorite}
        className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Heart className={cn('size-4', favorite && 'fill-destructive text-destructive')} />
      </button>
    </Link>
  );
}
