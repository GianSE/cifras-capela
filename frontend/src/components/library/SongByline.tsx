import type { SongIndexEntry } from '@/types/library';
import { cn } from '@/lib/utils';

/**
 * Segunda linha dos cards: artista e categoria.
 *
 * A categoria ficava numa pastilha à direita, escondida no celular por falta
 * de espaço. Na mesma linha do artista ela aparece em qualquer tela, e o
 * `truncate` corta o artista antes dela quando o nome é longo.
 */
export function SongByline({ song, className }: { song: SongIndexEntry; className?: string }) {
  const category = song.categories?.[0];
  if (!song.artist && !category) return null;

  return (
    <p className={cn('flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground', className)}>
      {song.artist && <span className="truncate">{song.artist}</span>}
      {song.artist && category && (
        <span aria-hidden className="shrink-0 text-[var(--color-outline)]">
          ·
        </span>
      )}
      {category && (
        <span className="shrink-0 font-medium capitalize text-gold-700 dark:text-gold-400">
          {category}
        </span>
      )}
    </p>
  );
}
