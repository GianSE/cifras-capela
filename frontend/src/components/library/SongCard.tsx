import { Link } from 'react-router';
import { Play } from 'lucide-react';
import type { SongIndexEntry } from '@/types/library';

interface SongCardProps {
  song: SongIndexEntry;
}

/**
 * Card compacto da fileira "Abertas recentemente".
 *
 * Vai no azul do manto — assim a fileira de recentes se lê como um bloco só e
 * dá o contraponto à lista de músicas em branco logo abaixo.
 */
export function SongCard({ song }: SongCardProps) {
  return (
    <Link
      to={`/musica/${song.id}`}
      className="group card-lift relative flex h-32 w-48 shrink-0 flex-col justify-end overflow-hidden rounded-2xl bg-[image:var(--gradient-blue)] p-4 text-ivory"
    >
      {/* Raio dourado no canto */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-gold-400/25 blur-2xl transition-opacity duration-300 group-hover:bg-gold-400/40"
      />

      {song.key && (
        <span className="absolute left-4 top-3.5 rounded-full border border-gold-400/35 px-2 py-0.5 font-mono text-xs font-semibold text-gold-300">
          {song.key}
        </span>
      )}

      <div className="relative min-w-0">
        <p className="font-display truncate text-lg text-ivory">{song.title}</p>
        {song.artist && <p className="truncate text-xs text-navy-200">{song.artist}</p>}
      </div>

      <span className="absolute bottom-3.5 right-3.5 flex size-9 items-center justify-center rounded-full bg-[image:var(--gradient-gold)] text-navy-900 opacity-0 shadow-gilded transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <Play className="size-4 fill-current" />
      </span>
    </Link>
  );
}
