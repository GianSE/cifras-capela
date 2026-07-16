import { Link } from 'react-router';
import { Music4 } from 'lucide-react';
import type { SongIndexEntry } from '@/types/library';
import { AddToPlaylist } from '@/components/playlist/AddToPlaylist';

interface SongListItemProps {
  song: SongIndexEntry;
}

/** Linha da lista de músicas: título, artista, tom e adicionar à playlist. */
export function SongListItem({ song }: SongListItemProps) {
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

      {/* Evita que abrir o diálogo navegue para a música. */}
      <span
        className="shrink-0"
        onClick={(e) => e.preventDefault()}
        role="presentation"
      >
        <AddToPlaylist songId={song.id} />
      </span>
    </Link>
  );
}
