import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Church, ListMusic, Plus, Trash2, ChevronRight, Library } from 'lucide-react';
import { usePlaylists } from '@/hooks/usePlaylists';
import { playlistStorage } from '@/lib/storage/playlists';
import { formatMissaName, isMissa, suggestMissaDates } from '@/lib/missa';
import { MissaDatePicker } from '@/components/playlist/MissaDatePicker';
import { cn } from '@/lib/utils';
import type { PlaylistKind } from '@/types/playlist';
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

/** Filtro da listagem: todas, só playlists livres ou só missas. */
type Filter = 'todas' | PlaylistKind;
const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'lista', label: 'Playlists' },
  { value: 'missa', label: 'Missas' },
];

export function PlaylistsPage() {
  const playlists = usePlaylists();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlaylistKind>('lista');
  const [missaDate, setMissaDate] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');

  const visible = playlists.filter((p) => {
    if (filter === 'todas') return true;
    return isMissa(p) === (filter === 'missa');
  });

  /** A missa quase sempre é no domingo: a data já vem preenchida com o próximo. */
  const openCreate = () => {
    setMissaDate(suggestMissaDates().sunday);
    setCreating(true);
  };

  const handleCreate = () => {
    // A missa se chama pela data; com o campo vazio, não cria nada.
    if (kind === 'missa' && !missaDate) return;
    const id = playlistStorage.create(
      kind === 'missa' ? formatMissaName(missaDate) : name,
      [],
      kind,
    );
    setName('');
    setKind('lista');
    setCreating(false);
    navigate(`/playlists/${id}`);
  };

  return (
    <>
      <PageHeader
        title="Playlists"
        icon={ListMusic}
        subtitle={`${playlists.length} ${playlists.length === 1 ? 'playlist' : 'playlists'} montadas`}
        actions={
          <Button
            variant="gold"
            size="sm"
            className="gap-1.5"
            onClick={openCreate}
            aria-label="Nova Playlist"
          >
            <Plus className="size-4" /> <span className="hidden sm:inline">Nova Playlist</span>
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
                <Button variant="gold" className="gap-2" onClick={openCreate}>
                  <Plus className="size-4" /> Criar playlist
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/home">
                    <Library className="size-4" /> Biblioteca
                  </Link>
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div
              className="mb-4 flex flex-wrap gap-1.5"
              role="group"
              aria-label="Filtrar playlists"
            >
              {FILTERS.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={filter === value ? 'default' : 'outline'}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className="h-8 px-3.5 text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma {filter === 'missa' ? 'missa' : 'playlist'} por aqui ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {visible.map((playlist) => (
                  <li key={playlist.id}>
                    <Link
                      to={`/playlists/${playlist.id}`}
                      className="group card-lift flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 hover:border-gold-400/60"
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy-700 text-gold-300 transition-colors group-hover:bg-navy-600">
                        {isMissa(playlist) ? (
                          <Church className="size-5" />
                        ) : (
                          <ListMusic className="size-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-display truncate text-lg text-foreground">
                          {playlist.name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {isMissa(playlist) && 'Missa · '}
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
          </>
        )}

        {/* Criar playlist */}
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova playlist</DialogTitle>
            </DialogHeader>

            {/* Tipo: lista livre ou missa já dividida nas partes da celebração. */}
            <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'lista', icon: ListMusic, label: 'Playlist', hint: 'Lista livre' },
                  { value: 'missa', icon: Church, label: 'Missa', hint: 'Entrada, Glória, Santo…' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === option.value}
                  onClick={() => setKind(option.value)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                    kind === option.value
                      ? 'border-gold-500 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                      : 'border-border hover:border-gold-400/60',
                  )}
                >
                  <option.icon className="size-5 text-gold-600 dark:text-gold-400" />
                  <span className="text-sm font-semibold text-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>

            {kind === 'missa' ? (
              <MissaDatePicker value={missaDate} onChange={setMissaDate} onSubmit={handleCreate} />
            ) : (
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Ex.: Culto de domingo"
              />
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={kind === 'missa' && !missaDate}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
