import { useState } from 'react';
import { Check, Church, ListPlus, Plus } from 'lucide-react';
import { usePlaylists } from '@/hooks/usePlaylists';
import { playlistStorage } from '@/lib/storage/playlists';
import { isMissa, sectionOf } from '@/lib/missa';
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
  /** Sobre a barra azul do leitor: clareia o ícone para contrastar. */
  onDark?: boolean;
  className?: string;
}

/**
 * Adiciona/remove a música de playlists. Marcar/desmarcar é instantâneo, e dá
 * para criar uma playlist nova já com a música dentro.
 */
export function AddToPlaylist({ songId, variant = 'icon', onDark, className }: AddToPlaylistProps) {
  const playlists = usePlaylists();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  /** Missa aberta para escolher em que parte a música entra. */
  const [choosingFor, setChoosingFor] = useState<string | null>(null);

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
            className={cn(onDark && 'text-navy-100 hover:bg-white/10 hover:text-ivory', className)}
          >
            <ListPlus className={cn(inAny && (onDark ? 'text-gold-300' : 'text-accent'))} />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
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
              const missa = isMissa(playlist);
              const section = missa ? sectionOf(playlist, songId) : undefined;
              const choosing = choosingFor === playlist.id;
              return (
                <li key={playlist.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (included) {
                        playlistStorage.removeSong(playlist.id, songId);
                      } else if (missa) {
                        // Na missa, primeiro escolhe a parte.
                        setChoosingFor(choosing ? null : playlist.id);
                      } else {
                        playlistStorage.addSong(playlist.id, songId);
                      }
                    }}
                    aria-expanded={missa && !included ? choosing : undefined}
                    aria-pressed={included}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                  >
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
                        included
                          ? 'border-gold-500 bg-[image:var(--gradient-gold)] text-navy-900'
                          : 'border-[var(--color-outline)]',
                      )}
                    >
                      {included && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        {missa && (
                          <Church className="size-3.5 shrink-0 text-gold-600 dark:text-gold-400" />
                        )}
                        {playlist.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {section
                          ? `Em ${section.name}`
                          : `${playlist.songIds.length} ${playlist.songIds.length === 1 ? 'música' : 'músicas'}`}
                      </span>
                    </span>
                  </button>

                  {choosing && !included && (
                    <div className="mb-2 ml-10 flex flex-wrap gap-1.5">
                      {(playlist.sections ?? []).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            playlistStorage.addSong(playlist.id, songId, s.id);
                            setChoosingFor(null);
                          }}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:border-gold-400/70 hover:text-foreground',
                            s.songIds.length > 0
                              ? 'border-border text-muted-foreground'
                              : 'border-dashed border-[var(--color-outline)] text-foreground',
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
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
