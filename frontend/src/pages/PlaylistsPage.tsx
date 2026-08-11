import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ListMusic, Plus, Trash2, ChevronRight, Library } from 'lucide-react';
import { usePlaylists } from '@/hooks/usePlaylists';
import { playlistStorage } from '@/lib/storage/playlists';
import { PageHeader } from '@/components/layout/PageHeader';
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
    <>
      <PageHeader
        eyebrow="Repertório"
        title="Playlists"
        icon={ListMusic}
        subtitle={`${playlists.length} ${playlists.length === 1 ? 'playlist' : 'playlists'} montadas`}
        actions={
          <Button variant="gold" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> <span className="hidden sm:inline">Nova</span>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
        {playlists.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title="Nenhuma playlist ainda"
            description="Monte o repertório do dia, arraste para ordenar e exporte tudo num PDF só."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="gold" className="gap-2" onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> Criar playlist
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/">
                    <Library className="size-4" /> Biblioteca
                  </Link>
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <Link
                  to={`/playlists/${playlist.id}`}
                  className="group card-lift flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 hover:border-gold-400/60"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy-700 text-gold-300 transition-colors group-hover:bg-navy-600">
                    <ListMusic className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-lg text-foreground">{playlist.name}</p>
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
    </>
  );
}
