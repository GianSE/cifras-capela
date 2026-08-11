import { Link } from 'react-router';
import { Music4 } from 'lucide-react';
import type { SongIndexEntry } from '@/types/library';
import { AddToPlaylist } from '@/components/playlist/AddToPlaylist';
import { FavoriteButton } from './FavoriteButton';

interface SongListItemProps {
  song: SongIndexEntry;
}

/** Linha da lista de músicas: título, artista, tom, favoritar e playlist. */
export function SongListItem({ song }: SongListItemProps) {
  return (
    <Link
      to={`/musica/${song.id}`}
      className="group card-lift flex items-center gap-2 rounded-2xl border border-border bg-card p-3 hover:border-gold-400/60 sm:gap-3.5 sm:p-3.5"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy-700 text-gold-300 transition-colors group-hover:bg-navy-600">
        <Music4 className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-lg text-foreground">{song.title}</p>
        {song.artist && <p className="truncate text-sm text-muted-foreground">{song.artist}</p>}
      </div>

      {song.key && (
        <span className="shrink-0 rounded-full border border-gold-500/40 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 py-1 font-mono text-sm font-semibold text-accent">
          {song.key}
        </span>
      )}

      <FavoriteButton songId={song.id} />

      {/*
       * A playlist some no celular: com ela, o título — que é o que se procura
       * na lista — truncava em telas de 390px. Continua a um toque de distância
       * dentro da música e na própria tela da playlist.
       * Evita também que abrir o diálogo navegue para a música.
       */}
      <span
        className="hidden shrink-0 sm:block"
        onClick={(e) => e.preventDefault()}
        role="presentation"
      >
        <AddToPlaylist songId={song.id} />
      </span>
    </Link>
  );
}
