import { Star } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  songId: string;
  /** Sobre a barra azul do leitor: clareia o ícone para contrastar. */
  onDark?: boolean;
  className?: string;
}

/** Estrela que marca/desmarca a música como favorita. */
export function FavoriteButton({ songId, onDark, className }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const marked = isFavorite(songId);

  return (
    <button
      type="button"
      // Vive dentro de `<Link>` na lista: sem isto, marcar abriria a música.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(songId);
      }}
      aria-pressed={marked}
      aria-label={marked ? 'Desmarcar como favorita' : 'Marcar como favorita'}
      title={marked ? 'Desmarcar como favorita' : 'Marcar como favorita'}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full transition-colors',
        marked
          ? 'text-gold-500'
          : onDark
            ? 'text-navy-200 hover:bg-white/10 hover:text-gold-300'
            : 'text-muted-foreground hover:bg-[var(--color-surface-hover)] hover:text-gold-600',
        className,
      )}
    >
      <Star className={cn('size-[18px]', marked && 'fill-current')} />
    </button>
  );
}
