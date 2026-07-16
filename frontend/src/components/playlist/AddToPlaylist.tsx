import { useState } from 'react';
import { Check, ListPlus, Plus } from 'lucide-react';
import { usePlaylists } from '@/hooks/usePlaylists';
import { playlistStorage } from '@/lib/storage/playlists';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface AddToPlaylistProps {
  songId: string;
  /** Renderiza como botão de ícone (leitor) ou botão com rótulo. */
  variant?: 'icon' | 'button';
  className?: string;
}

/**
 * Adiciona/remove a música de playlists. Marcar/desmarcar é instantâneo, e dá
 * para criar uma playlist nova já com a música dentro.
 */
export function AddToPlaylist({ songId, variant = 'icon', className }: AddToPlaylistProps) {
  const playlists = usePlaylists();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const inAny = playlists.some((p) => p.songIds.includes(songId));

  const handleCreate = () => {
    if (!newName.trim()) return;
    playlistStorage.create(newName, [songId]);
    setNewName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Adicionar a uma playlist"
            className={className}
          >
            <ListPlus className={cn(inAny && 'text-primary')} />
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className={cn('gap-1.5', className)}>
            <ListPlus className="size-4" /> Playlist
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar à playlist</DialogTitle>
        </DialogHeader>

        {playlists.length > 0 && (
          <ul className="-mx-1 max-h-64 overflow-y-auto px-1">
            {playlists.map((playlist) => {
              const included = playlist.songIds.includes(songId);
              return (
                <li key={playlist.id}>
                  <button
                    type="button"
                    onClick={() =>
                      included
                        ? playlistStorage.removeSong(playlist.id, songId)
                        : playlistStorage.addSong(playlist.id, songId)
                    }
                    aria-pressed={included}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                  >
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded border',
                        included ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                      )}
                    >
                      {included && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {playlist.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {playlist.songIds.length}{' '}
                        {playlist.songIds.length === 1 ? 'música' : 'músicas'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex gap-2 border-t border-border pt-4">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Criar nova playlist…"
          />
          <Button onClick={handleCreate} disabled={!newName.trim()} className="shrink-0 gap-1.5">
            <Plus className="size-4" /> Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
