import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ListMusic, Plus, Trash2, ChevronRight, Library } from 'lucide-react';
import { usePlaylists } from '@/hooks/usePlaylists';
import { playlistStorage } from '@/lib/storage/playlists';
import { EmptyState } from '@/components/library/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

/** Data legível para o subtítulo do card. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function PlaylistsPage() {
  const playlists = usePlaylists();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = () => {
    const id = playlistStorage.create(name);
    setName('');
    setCreating(false);
    navigate(`/playlists/${id}`);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ListMusic className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">
              Playlists
            </h1>
            <p className="text-xs text-muted-foreground">
              {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
            </p>
          </div>
        </div>

        <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> <span className="hidden sm:inline">Nova</span>
        </Button>
      </header>

      {playlists.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="Nenhuma playlist ainda"
          description="Monte o repertório do dia, arraste para ordenar e exporte tudo num PDF só."
          action={
            <div className="flex gap-2">
              <Button className="gap-2" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Criar playlist
              </Button>
              <Button asChild variant="secondary" className="gap-2">
                <Link to="/">
                  <Library className="size-4" /> Biblioteca
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {playlists.map((playlist) => (
            <li key={playlist.id}>
              <Link
                to={`/playlists/${playlist.id}`}
                className="group flex items-center gap-3 rounded-xl border border-transparent bg-card p-3 transition-colors hover:border-border hover:bg-[var(--color-surface-container-high)]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-container-high)] text-primary">
                  <ListMusic className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{playlist.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {playlist.songIds.length}{' '}
                    {playlist.songIds.length === 1 ? 'música' : 'músicas'} ·{' '}
                    {formatDate(playlist.updatedAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm(`Excluir a playlist "${playlist.name}"?`)) {
                      playlistStorage.remove(playlist.id);
                    }
                  }}
                  aria-label={`Excluir ${playlist.name}`}
                  className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Criar playlist */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova playlist</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Ex.: Culto de domingo"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
