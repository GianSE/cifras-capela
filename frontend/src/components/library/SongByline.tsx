import { Camera } from 'lucide-react';
import type { SongIndexEntry } from '@/types/library';
import { cn } from '@/lib/utils';

/**
 * Artista e categoria dos cards, abaixo do título.
 *
 * A categoria é uma pastilha, como antes — mas dentro do card, e não mais na
 * direita, onde sumia no celular. Quando o artista é longo (ou a tela é
 * estreita) a pastilha desce sozinha: no celular o card fica em três linhas —
 * música, artista e categoria.
 */
export function SongByline({ song, className }: { song: SongIndexEntry; className?: string }) {
  const category = song.categories?.[0];
  // Só a foto, ainda sem cifra: o tom e a transposição não valem para ela.
  const onlyScan = Boolean(song.scan) && !song.lyrics;
  if (!song.artist && !category && !onlyScan) return null;

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {song.artist && (
        <span className="min-w-0 max-w-full truncate text-sm text-muted-foreground">
          {song.artist}
        </span>
      )}
      {onlyScan && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          <Camera className="size-3" /> Só a foto
        </span>
      )}
      {category && (
        <span className="shrink-0 rounded-full border border-gold-500/35 bg-[color-mix(in_srgb,var(--color-gold-400)_10%,transparent)] px-2 py-0.5 text-[11px] font-semibold capitalize text-gold-700 dark:text-gold-400">
          {category}
        </span>
      )}
    </div>
  );
}
