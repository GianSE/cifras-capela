import { useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import type { SongIndexEntry } from '@/types/library';
import { cn } from '@/lib/utils';

/** Movimento (px) acima do qual o gesto é considerado arraste, não clique. */
const CLICK_SLOP = 6;

interface SortableSongItemProps {
  song: SongIndexEntry;
  /** Posição na playlist (1-indexed, exibida no card). */
  position: number;
  /** Tom em que a música será tocada (já transposto), se houver. */
  displayKey?: string;
  /** Semitons salvos — mostra o quanto foi transposto (0 = tom original). */
  semitones?: number;
  onOpen: (songId: string) => void;
  onRemove: (songId: string) => void;
}

/**
 * Card de música dentro da playlist, reordenável.
 *
 * Segurar e arrastar (mouse ou dedo) reordena; um toque simples abre a música.
 * Pelo teclado: Espaço pega/solta, setas movem, Enter abre.
 */
export function SortableSongItem({
  song,
  position,
  displayKey,
  semitones = 0,
  onOpen,
  onRemove,
}: SortableSongItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.id,
  });

  // O navegador dispara `click` no pointerup mesmo depois de um arraste, o que
  // abriria a música ao soltar o card. Comparamos a posição inicial e final do
  // ponteiro para distinguir um clique de verdade de um arraste.
  const pressPos = useRef<{ x: number; y: number } | null>(null);

  // Os sensores de mouse/toque usam `onMouseDown`/`onTouchStart` (vêm do
  // spread de `listeners`); este `pointerdown` serve só para medir o gesto.
  const handlePointerDown = (e: React.PointerEvent) => {
    pressPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    const start = pressPos.current;
    pressPos.current = null;
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved <= CLICK_SLOP) onOpen(song.id);
  };

  /**
   * Enter abre a música; as demais teclas seguem para o KeyboardSensor
   * (Espaço pega/solta, setas movem). Sem repassar, o arraste por teclado
   * quebraria, já que este handler sobrescreve o de `listeners`.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onOpen(song.id);
      return;
    }
    listeners?.onKeyDown?.(e);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex cursor-pointer select-none items-center gap-3 rounded-xl border bg-card p-3 transition-colors',
        isDragging
          ? 'relative z-10 border-primary opacity-95 shadow-2xl'
          : 'border-transparent hover:border-border hover:bg-[var(--color-surface-container-high)]',
      )}
    >
      <span className="w-5 shrink-0 text-center font-mono text-sm text-muted-foreground">
        {position}
      </span>

      <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{song.title}</p>
        {song.artist && <p className="truncate text-sm text-muted-foreground">{song.artist}</p>}
      </div>

      {/* Tom de execução (o transposto), com o quanto foi movido do original. */}
      {(displayKey ?? song.key) && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-md bg-[var(--color-surface-container-highest)] px-2 py-1 font-mono text-sm font-semibold text-accent">
            {displayKey ?? song.key}
          </span>
          {semitones !== 0 && (
            <span className="font-mono text-[11px] font-medium text-primary">
              {semitones > 0 ? `+${semitones}` : semitones}
            </span>
          )}
        </span>
      )}

      <button
        type="button"
        // Impede que o clique/arraste no botão dispare o drag ou abra a música.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(song.id);
        }}
        aria-label={`Remover ${song.title} da playlist`}
        className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
