import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { ChevronLeft, FileDown, ListMusic, Play, Plus, Pencil } from 'lucide-react';
import { usePlaylist } from '@/hooks/usePlaylists';
import { usePlaylistSongs } from '@/hooks/usePlaylistSongs';
import { useLibrary } from '@/hooks/useLibrary';
import { usePreferences } from '@/hooks/usePreferences';
import { playlistStorage } from '@/lib/storage/playlists';
import { transposeSong, getKeyFromSemitones } from '@/lib/transpose';
import { SortableSongItem } from '@/components/playlist/SortableSongItem';
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

export function PlaylistPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const playlist = usePlaylist(id);
  const { songs: allSongs, isLoading } = useLibrary();
  const { loadSongs } = usePlaylistSongs();
  const { transpositions, preferFlats } = usePreferences();

  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [query, setQuery] = useState('');

  // Sensores separados por tipo de entrada, porque a intenção do usuário difere:
  //  - Mouse: pressionar e mover 6px já arrasta (clicar sem mover abre a música).
  //  - Toque: exige segurar 220ms, senão o deslize do dedo rolaria a página em
  //    vez de reordenar (o `tolerance` só cancela se mover antes do delay).
  //  - Teclado: Espaço pega/solta e as setas movem; o Enter fica livre p/ abrir.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  /** Músicas da playlist, na ordem salva. */
  const songs = useMemo(() => {
    if (!playlist) return [];
    const byId = new Map(allSongs.map((s) => [s.id, s]));
    return playlist.songIds.map((songId) => byId.get(songId)).filter((s) => s !== undefined);
  }, [playlist, allSongs]);

  /** Candidatas a adicionar: tudo que ainda não está na playlist. */
  const candidates = useMemo(() => {
    if (!playlist) return [];
    const inPlaylist = new Set(playlist.songIds);
    const q = query.trim().toLowerCase();
    return allSongs
      .filter((s) => !inPlaylist.has(s.id))
      .filter(
        (s) =>
          !q || s.title.toLowerCase().includes(q) || (s.artist ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }, [allSongs, playlist, query]);

  if (!playlist) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <EmptyState
          icon={ListMusic}
          title="Playlist não encontrada"
          action={
            <Button asChild variant="secondary" className="gap-2">
              <Link to="/playlists">
                <ChevronLeft className="size-4" /> Voltar
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = playlist.songIds.indexOf(String(active.id));
    const newIndex = playlist.songIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    playlistStorage.reorder(playlist.id, arrayMove([...playlist.songIds], oldIndex, newIndex));
  };

  /**
   * Gera um PDF único com todas as músicas, na ordem da playlist e **no tom em
   * que cada uma foi deixada** — é esse o tom que você vai tocar no dia.
   * Quando há transposição, o cabeçalho registra o tom original.
   */
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const loaded = await loadSongs(playlist.songIds);
      const entries = loaded.map(({ id, song }) => {
        const semitones = transpositions[id] ?? 0;
        const originalKey = song.metadata.key;
        return {
          song:
            semitones === 0 && !preferFlats ? song : transposeSong(song, semitones, preferFlats),
          ...(semitones !== 0 && originalKey && { note: `orig. ${originalKey}` }),
        };
      });

      const { exportPlaylistToPdf } = await import('@/lib/export/pdf');
      await exportPlaylistToPdf(entries, playlist.name);
    } catch (e) {
      console.error('Falha ao exportar a playlist em PDF:', e);
    } finally {
      setExporting(false);
    }
  };

  /** Abre a primeira música já no contexto da playlist. */
  const handlePlay = () => {
    const first = playlist.songIds[0];
    if (first) navigate(`/musica/${first}?playlist=${playlist.id}`);
  };

  const openSong = (songId: string) => navigate(`/musica/${songId}?playlist=${playlist.id}`);

  return (
    <>
      <PageHeader
        eyebrow="Playlist"
        title={playlist.name}
        subtitle={`${songs.length} ${songs.length === 1 ? 'música' : 'músicas'} · arraste para ordenar`}
        actions={
          <>
            <Button
              variant="outline-dark"
              className="gap-1.5"
              onClick={handleExportPdf}
              disabled={exporting || songs.length === 0}
              title="Baixar todas as músicas num PDF só"
            >
              <FileDown className="size-4" />
              <span className="hidden sm:inline">{exporting ? 'Gerando…' : 'PDF'}</span>
            </Button>
            <Button
              variant="gold"
              className="gap-1.5"
              onClick={handlePlay}
              disabled={songs.length === 0}
            >
              <Play className="size-4" /> <span className="hidden sm:inline">Tocar</span>
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2">
          <Button variant="outline-dark" size="sm" asChild className="gap-1.5">
            <Link to="/playlists">
              <ChevronLeft className="size-4" /> Playlists
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-navy-100 hover:bg-white/10 hover:text-ivory"
            onClick={() => {
              setDraftName(playlist.name);
              setRenaming(true);
            }}
          >
            <Pencil className="size-3.5" /> Renomear
          </Button>
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
        {/* Lista reordenável */}
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[70px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title="Playlist vazia"
            description="Adicione as músicas do dia e arraste os cards para definir a ordem."
            action={
              <Button variant="gold" className="gap-2" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Adicionar músicas
              </Button>
            }
          />
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={songs.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2.5">
                  {songs.map((song, index) => {
                    const semitones = transpositions[song.id] ?? 0;
                    return (
                      <SortableSongItem
                        key={song.id}
                        song={song}
                        position={index + 1}
                        semitones={semitones}
                        displayKey={
                          song.key
                            ? getKeyFromSemitones(song.key, semitones, preferFlats)
                            : undefined
                        }
                        onOpen={openSong}
                        onRemove={(songId) => playlistStorage.removeSong(playlist.id, songId)}
                      />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Segure e arraste um card para mudar a ordem.
            </p>

            <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Adicionar músicas
            </Button>
          </>
        )}

        {/* Adicionar músicas */}
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar músicas</DialogTitle>
            </DialogHeader>

            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou artista…"
            />

            <ul className="-mx-1 max-h-80 overflow-y-auto px-1">
              {candidates.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma música disponível.
                </li>
              ) : (
                candidates.map((song) => (
                  <li key={song.id}>
                    <button
                      type="button"
                      onClick={() => playlistStorage.addSong(playlist.id, song.id)}
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <Plus className="size-4 shrink-0 text-gold-600 dark:text-gold-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {song.title}
                        </span>
                        {song.artist && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {song.artist}
                          </span>
                        )}
                      </span>
                      {song.key && (
                        <span className="shrink-0 font-mono text-xs font-semibold text-accent">
                          {song.key}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>

            <DialogFooter>
              <DialogClose asChild>
                <Button>Concluir</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Renomear */}
        <Dialog open={renaming} onOpenChange={setRenaming}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renomear playlist</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  playlistStorage.rename(playlist.id, draftName);
                  setRenaming(false);
                }
              }}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  playlistStorage.rename(playlist.id, draftName);
                  setRenaming(false);
                }}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
