import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router';
import { Church, ChevronRight, GripVertical, ListMusic, Trash2 } from 'lucide-react';
import type { Playlist } from '@/types/playlist';
import { cn } from '@/lib/utils';

interface SortablePlaylistItemProps {
  playlist: Playlist;
  missa: boolean;
  subtitle: string;
  onRemove: () => void;
}

/**
 * Card de playlist na listagem, reordenável por arrastar-e-soltar — reordena
 * só a LISTAGEM, não as músicas de dentro de cada playlist.
 */
export function SortablePlaylistItem({
  playlist,
  missa,
  subtitle,
  onRemove,
}: SortablePlaylistItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: playlist.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group card-lift flex items-center gap-3.5 rounded-2xl border bg-card p-3.5 transition-colors',
        isDragging
          ? 'relative z-10 border-gold-500 opacity-95 shadow-floating'
          : 'border-border hover:border-gold-400/60',
      )}
    >
      {/* Alça exclusiva: só ela arrasta, o resto do card continua navegável por clique. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${playlist.name}`}
        className="shrink-0 cursor-grab touch-none rounded-full p-1 text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      <Link to={`/playlists/${playlist.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy-700 text-gold-300 transition-colors group-hover:bg-navy-600">
          {missa ? <Church className="size-5" /> : <ListMusic className="size-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-lg text-foreground">{playlist.name}</p>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </Link>

      {playlist.isOwner !== false && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Excluir ${playlist.name}`}
          className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </li>
  );
}
