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
import {
  Check,
  ChevronLeft,
  FileDown,
  Link2,
  ListMusic,
  Loader2,
  Play,
  Plus,
  Pencil,
  Share2,
} from 'lucide-react';
import { usePlaylist } from '@/hooks/usePlaylists';
import { useRemotePlaylist } from '@/hooks/useRemotePlaylist';
import { usePlaylistSongs } from '@/hooks/usePlaylistSongs';
import { useLibrary } from '@/hooks/useLibrary';
import { usePreferences } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { playlistStorage } from '@/lib/storage/playlists';
import { transposeSong, getKeyFromSemitones } from '@/lib/transpose';
import { SortableSongItem } from '@/components/playlist/SortableSongItem';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/library/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { Playlist } from '@/types/playlist';
import type { SongIndexEntry } from '@/types/library';
import { SongByline } from '@/components/library/SongByline';
import { VideoButton } from '@/components/video/VideoButton';

/**
 * `/playlists/:id` — a playlist deste aparelho (editável) ou, quando não está
 * aqui, a compartilhada de outra pessoa, buscada no servidor (só leitura).
 */
export function PlaylistPage() {
  const { id = '' } = useParams();
  const local = usePlaylist(id);
  const remote = useRemotePlaylist(id, !local);

  if (local) return <OwnPlaylist playlist={local} />;
  if (remote.status === 'found') return <SharedPlaylist playlist={remote.playlist} />;

  if (remote.status === 'loading' || remote.status === 'idle') {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-2.5 px-4 py-10 md:px-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[70px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <EmptyState
        icon={ListMusic}
        title={
          remote.status === 'error' ? 'Não foi possível abrir a playlist' : 'Playlist não encontrada'
        }
        description={
          remote.status === 'error'
            ? 'Verifique a conexão e tente de novo.'
            : 'Ela pode ter sido excluída, ou quem montou desligou o compartilhamento.'
        }
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

/** Músicas da playlist, na ordem salva (as que não existem mais ficam de fora). */
function usePlaylistEntries(playlist: Playlist) {
  const { songs: allSongs, isLoading } = useLibrary();
  const songs = useMemo(() => {
    const byId = new Map(allSongs.map((s) => [s.id, s]));
    return playlist.songIds.map((songId) => byId.get(songId)).filter((s) => s !== undefined);
  }, [playlist, allSongs]);
  return { songs, allSongs, isLoading };
}

/**
 * Gera um PDF único com todas as músicas, na ordem da playlist e **no tom em
 * que cada uma foi deixada** — é esse o tom que você vai tocar no dia.
 * Quando há transposição, o cabeçalho registra o tom original.
 */
function usePlaylistPdf(playlist: Playlist) {
  const { loadSongs } = usePlaylistSongs();
  const { transpositions, preferFlats } = usePreferences();
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
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

  return { exportPdf, exporting };
}

/** PDF e Tocar — iguais na playlist própria e na compartilhada. */
function PlaylistActions({
  playlist,
  songCount,
}: {
  playlist: Playlist;
  songCount: number;
}) {
  const navigate = useNavigate();
  const { exportPdf, exporting } = usePlaylistPdf(playlist);

  /** Abre a primeira música já no contexto da playlist. */
  const handlePlay = () => {
    const first = playlist.songIds[0];
    if (first) navigate(`/musica/${first}?playlist=${playlist.id}`);
  };

  return (
    <>
      <Button
        variant="outline-dark"
        size="sm"
        className="gap-1.5"
        onClick={() => void exportPdf()}
        disabled={exporting || songCount === 0}
        title="Baixar todas as músicas num PDF só"
      >
        <FileDown className="size-4" />
        <span className="hidden sm:inline">{exporting ? 'Gerando…' : 'PDF'}</span>
      </Button>
      <Button
        variant="gold"
        size="sm"
        className="gap-1.5"
        onClick={handlePlay}
        disabled={songCount === 0}
      >
        <Play className="size-4" /> <span className="hidden sm:inline">Tocar</span>
      </Button>
    </>
  );
}

function OwnPlaylist({ playlist }: { playlist: Playlist }) {
  const navigate = useNavigate();
  const { songs, allSongs, isLoading } = usePlaylistEntries(playlist);
  const { transpositions, preferFlats } = usePreferences();

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

  /** Candidatas a adicionar: tudo que ainda não está na playlist. */
  const candidates = useMemo(() => {
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

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = playlist.songIds.indexOf(String(active.id));
    const newIndex = playlist.songIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    playlistStorage.reorder(playlist.id, arrayMove([...playlist.songIds], oldIndex, newIndex));
  };

  const openSong = (songId: string) => navigate(`/musica/${songId}?playlist=${playlist.id}`);

  return (
    <>
      <PageHeader
        title={playlist.name}
        subtitle={`${songs.length} ${songs.length === 1 ? 'música' : 'músicas'} · arraste para ordenar`}
        actions={<PlaylistActions playlist={playlist} songCount={songs.length} />}
      >
        {/* Já sobre o marfim: variantes claras, não as de fundo azul. */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/playlists">
              <ChevronLeft className="size-4" /> Playlists
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
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
        <ShareCard playlist={playlist} />

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

/**
 * Liga/desliga o compartilhamento e entrega o link. Ligado, quem abrir o link
 * vê a playlist — inclusive como convidado —, mas só o dono altera.
 */
function ShareCard({ playlist }: { playlist: Playlist }) {
  const { isSignedIn, isLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shared = playlist.shared === true;
  const link = `${window.location.origin}/playlists/${playlist.id}`;

  const toggle = async (next: boolean) => {
    setSaving(true);
    setError(null);
    const ok = await playlistStorage.setShared(playlist.id, next);
    setSaving(false);
    if (!ok) setError('Não foi possível salvar no servidor. Verifique a conexão e tente de novo.');
  };

  /** No celular abre o menu de compartilhar do sistema; no PC, copia. */
  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: playlist.name, url: link });
        return;
      } catch (e) {
        // Fechar o menu sem escolher não é erro; outra falha cai na cópia.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não deu para copiar. Selecione o link e copie manualmente.');
    }
  };

  const canShare = isSignedIn && !isLoading;

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy-700 text-gold-300">
          <Share2 className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="compartilhar" className="block font-semibold text-foreground">
            Compartilhar
          </label>
          <p className="text-sm text-muted-foreground">
            {!canShare && !isLoading
              ? 'Entre na sua conta para compartilhar esta playlist.'
              : shared
                ? 'Quem tiver o link vê a playlist, mesmo como convidado.'
                : 'Ligue para mandar o link a quem vai tocar com você.'}
          </p>
        </div>
        {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <Switch
          id="compartilhar"
          checked={shared}
          disabled={!canShare || saving}
          onCheckedChange={(next) => void toggle(next)}
        />
      </div>

      {shared && canShare && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={link}
            aria-label="Link da playlist"
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <Button
            variant="secondary"
            className="shrink-0 gap-1.5"
            onClick={() => void shareLink()}
          >
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? 'Link copiado' : 'Copiar link'}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

/** Playlist de outra pessoa, aberta pelo link: só leitura, mas toca e baixa o PDF. */
function SharedPlaylist({ playlist }: { playlist: Playlist }) {
  const navigate = useNavigate();
  const { songs, isLoading } = usePlaylistEntries(playlist);
  const { transpositions, preferFlats } = usePreferences();

  return (
    <>
      <PageHeader
        title={playlist.name}
        subtitle={`Playlist compartilhada · ${songs.length} ${songs.length === 1 ? 'música' : 'músicas'}`}
        actions={<PlaylistActions playlist={playlist} songCount={songs.length} />}
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
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
            description="Quem montou ainda não adicionou músicas."
          />
        ) : (
          <ol className="flex flex-col gap-2.5">
            {songs.map((song, index) => (
              <SharedSongItem
                key={song.id}
                song={song}
                position={index + 1}
                displayKey={
                  song.key
                    ? getKeyFromSemitones(song.key, transpositions[song.id] ?? 0, preferFlats)
                    : undefined
                }
                onOpen={() => navigate(`/musica/${song.id}?playlist=${playlist.id}`)}
              />
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

function SharedSongItem({
  song,
  position,
  displayKey,
  onOpen,
}: {
  song: SongIndexEntry;
  position: number;
  displayKey?: string;
  onOpen: () => void;
}) {
  return (
    // O card é uma div com o botão principal esticado por cima (`after:inset-0`):
    // o botão do vídeo não pode ficar *dentro* de outro botão.
    <li className="relative flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-colors hover:border-gold-400/60">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-700 font-mono text-sm font-semibold text-gold-300">
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="font-display block w-full truncate text-left text-lg text-foreground after:absolute after:inset-0 after:rounded-2xl"
        >
          {song.title}
        </button>
        <SongByline song={song} />
      </div>
      {song.youtube && (
        <VideoButton videoId={song.youtube} title={song.title} className="relative z-10" />
      )}
      {displayKey && (
        <span className="shrink-0 rounded-full border border-gold-500/40 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 py-1 font-mono text-sm font-semibold text-accent">
          {displayKey}
        </span>
      )}
    </li>
  );
}
