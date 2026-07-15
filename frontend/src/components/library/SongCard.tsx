import { Link } from 'react-router';
import { Play } from 'lucide-react';
import type { SongIndexEntry } from '@/types/library';

interface SongCardProps {
  song: SongIndexEntry;
}

/** Card compacto (usado na fileira "Recentes"). */
export function SongCard({ song }: SongCardProps) {
  return (
    <Link
      to={`/musica/${song.id}`}
      className="group relative flex h-32 w-44 shrink-0 flex-col justify-end overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:bg-[var(--color-surface-container-high)]"
    >
      {/* blob decorativo */}
      <div className="absolute -right-6 -top-6 size-20 rounded-full bg-primary/20 blur-2xl transition-opacity group-hover:opacity-100" />

      {song.key && (
        <span className="absolute right-3 top-3 rounded-md bg-[var(--color-surface-container-highest)] px-2 py-0.5 font-mono text-xs font-semibold text-accent">
          {song.key}
        </span>
      )}

      <div className="relative">
        <p className="truncate font-semibold text-foreground">{song.title}</p>
        {song.artist && <p className="truncate text-xs text-muted-foreground">{song.artist}</p>}
      </div>

      <span className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        <Play className="size-4 fill-current" />
      </span>
    </Link>
  );
}
