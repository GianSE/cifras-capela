import { useCallback, useMemo, useRef, useState } from 'react';
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
  CalendarDays,
  Church,
  ChevronLeft,
  FileDown,
  ListMusic,
  Play,
  Plus,
  Pencil,
} from 'lucide-react';
import { usePlaylist } from '@/hooks/usePlaylists';
import { useRemotePlaylist } from '@/hooks/useRemotePlaylist';
import { usePlaylistSongs } from '@/hooks/usePlaylistSongs';
import { useLibrary } from '@/hooks/useLibrary';
import { usePreferences } from '@/hooks/usePreferences';
import { playlistStorage } from '@/lib/storage/playlists';
import {
  formatMissaName,
  isMissa,
  parseMissaDate,
  sectionOf,
  suggestMissaDates,
} from '@/lib/missa';
import { MissaDatePicker } from '@/components/playlist/MissaDatePicker';
import {
  PdfPreviewDialog,
  type GeneratedPdf,
  type PdfChoice,
} from '@/components/playlist/PdfPreviewDialog';
import {
  MissaDayBanner,
  SuggestionsButton,
  SuggestionsDialog,
} from '@/components/playlist/MissaSuggestions';
import { useAuth } from '@/hooks/useAuth';
import { useMissaSuggestions } from '@/hooks/useMissaSuggestions';
import { suggestionsForSection } from '@/lib/missa-suggestions';
import { MissaSections } from '@/components/playlist/MissaSections';
import { SongPicker } from '@/components/playlist/SongPicker';
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
import { songHasContent } from '@/lib/library/derive';
import type { Playlist, PlaylistSection } from '@/types/playlist';
import type { Song } from '@/types/song';
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
          remote.status === 'error'
            ? 'Não foi possível abrir a playlist'
            : 'Playlist não encontrada'
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
  const byId = useMemo(() => new Map(allSongs.map((s) => [s.id, s])), [allSongs]);
  const songs = useMemo(
    () => playlist.songIds.map((songId) => byId.get(songId)).filter((s) => s !== undefined),
    [playlist, byId],
  );
  /** Músicas de uma parte da missa (as que não existem mais ficam de fora). */
  const sectionSongs = (section: PlaylistSection) =>
    section.songIds.map((songId) => byId.get(songId)).filter((s) => s !== undefined);
  return { songs, allSongs, sectionSongs, isLoading };
}

/** Subtítulo: na missa, conta também quantas partes já têm música. */
function playlistSubtitle(playlist: Playlist, songCount: number, suffix: string): string {
  const songs = `${songCount} ${songCount === 1 ? 'música' : 'músicas'}`;
  if (!isMissa(playlist)) return `${songs}${suffix}`;
  const sections = playlist.sections ?? [];
  const filled = sections.filter((s) => s.songIds.length > 0).length;
  return `Missa · ${filled}/${sections.length} partes · ${songs}`;
}

/**
 * As páginas da folha, se a música for só ela. Sem conseguir abrir, o PDF sai com o
 * título: um arquivo sem uma música é melhor que nenhum arquivo.
 */
async function folhaPages(song: Song) {
  if (!song.metadata.scan || songHasContent(song)) return undefined;
  try {
    const { loadScanForPdf } = await import('@/lib/scan-images');
    return await loadScanForPdf(song.metadata.scan);
  } catch (e) {
    console.warn('Não foi possível abrir a folha para o PDF:', e);
    return undefined;
  }
}

/** O nome da missa é só a data: no PDF, a capa e o arquivo precisam dizer o que é. */
function pdfTitle(playlist: Playlist): string {
  return isMissa(playlist) && parseMissaDate(playlist.name)
    ? `Missa · ${playlist.name}`
    : playlist.name;
}

/**
 * Monta o PDF da playlist para a prévia: na ordem da playlist e **no tom em que
 * cada uma foi deixada** — é esse o tom que você vai tocar no dia. Quando há
 * transposição, o cabeçalho registra o tom original.
 *
 * Só a letra é para quem canta: tom não importa, e a parte da missa continua.
 * As cifras são carregadas uma vez por abertura; trocar a opção só remonta.
 */
function usePlaylistPdf(playlist: Playlist) {
  const { loadSongs } = usePlaylistSongs();
  const { transpositions, preferFlats } = usePreferences();
  const loaded = useRef<{ key: string; data: Promise<LoadedForPdf[]> } | null>(null);

  const load = useCallback((): Promise<LoadedForPdf[]> => {
    const key = playlist.songIds.join('|');
    if (loaded.current?.key !== key) {
      const data = loadSongs(playlist.songIds).then((songs) =>
        Promise.all(songs.map(async (s) => ({ ...s, images: await folhaPages(s.song) }))),
      );
      // Falhou: a próxima tentativa carrega de novo.
      data.catch(() => {
        loaded.current = null;
      });
      loaded.current = { key, data };
    }
    return loaded.current.data;
  }, [playlist.songIds, loadSongs]);

  const generate = useCallback(
    async ({ lyricsOnly, toc }: PdfChoice): Promise<GeneratedPdf> => {
      const songs = await load();
      const entries = songs.map(({ id, song, images }) => {
        const part = sectionOf(playlist, id)?.name;
        if (lyricsOnly) {
          return { song, ...(part && { note: part, part }), ...(images && { images }) };
        }
        const semitones = transpositions[id] ?? 0;
        const originalKey = song.metadata.key;
        // Na missa, o cabeçalho de cada música diz a parte (ex.: "Entrada").
        const note = [part, semitones !== 0 && originalKey ? `orig. ${originalKey}` : undefined]
          .filter(Boolean)
          .join(' · ');
        return {
          song:
            semitones === 0 && !preferFlats ? song : transposeSong(song, semitones, preferFlats),
          ...(note && { note }),
          ...(part && { part }),
          ...(images && { images }),
        };
      });

      const { buildPlaylistPdf, pdfBytes } = await import('@/lib/export/pdf');
      const pdf = await buildPlaylistPdf(entries, {
        title: pdfTitle(playlist),
        lyricsOnly,
        toc,
      });
      return { bytes: pdfBytes(pdf), filename: pdf.filename };
    },
    [load, playlist, transpositions, preferFlats],
  );

  return { generate };
}

interface LoadedForPdf {
  readonly id: string;
  readonly song: Song;
  readonly images: Awaited<ReturnType<typeof folhaPages>>;
}

/** PDF e Tocar — iguais na playlist própria e na compartilhada. */
function PlaylistActions({ playlist, songCount }: { playlist: Playlist; songCount: number }) {
  const navigate = useNavigate();
  const { generate } = usePlaylistPdf(playlist);
  const [previewing, setPreviewing] = useState(false);

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
        disabled={songCount === 0}
        onClick={() => setPreviewing(true)}
        title="Ver e baixar todas as músicas num PDF só"
        aria-label="Exportar PDF"
      >
        <FileDown className="size-4" />
        <span className="hidden sm:inline">PDF</span>
      </Button>
      <PdfPreviewDialog
        open={previewing}
        onOpenChange={setPreviewing}
        title={pdfTitle(playlist)}
        generate={generate}
      />
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
  const { songs, allSongs, sectionSongs, isLoading } = usePlaylistEntries(playlist);
  const { transpositions, preferFlats } = usePreferences();
  const missa = isMissa(playlist);

  // Trazer música do site é de quem pode importar: para os demais, não há sugestões.
  const { isAdmin } = useAuth();
  const suggestions = useMissaSuggestions(missa && isAdmin ? playlist : null);
  const [suggesting, setSuggesting] = useState<PlaylistSection | null>(null);

  /** Seletor de músicas aberto; na missa, aponta a parte que vai recebê-la. */
  const [adding, setAdding] = useState<{ section?: PlaylistSection } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDate, setDraftDate] = useState('');

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

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    // Missa: o arraste reordena dentro da parte (cada parte é uma lista).
    if (missa) {
      const section = sectionOf(playlist, String(active.id));
      if (!section) return;
      const from = section.songIds.indexOf(String(active.id));
      const to = section.songIds.indexOf(String(over.id));
      if (from === -1 || to === -1) return;
      playlistStorage.reorderSection(
        playlist.id,
        section.id,
        arrayMove([...section.songIds], from, to),
      );
      return;
    }
    const oldIndex = playlist.songIds.indexOf(String(active.id));
    const newIndex = playlist.songIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    playlistStorage.reorder(playlist.id, arrayMove([...playlist.songIds], oldIndex, newIndex));
  };

  const openSong = (songId: string) => navigate(`/musica/${songId}?playlist=${playlist.id}`);

  const saveName = () => {
    if (missa && !draftDate) return;
    playlistStorage.rename(playlist.id, missa ? formatMissaName(draftDate) : draftName);
    setRenaming(false);
  };

  const pickSong = (songId: string) => {
    if (missa) {
      playlistStorage.addSong(playlist.id, songId, adding?.section?.id);
      // Uma música por parte é o comum: escolheu, volta para a missa.
      setAdding(null);
    } else {
      playlistStorage.addSong(playlist.id, songId);
    }
  };

  const renderSortable = (items: typeof songs) => (
    <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
      <ul className="flex flex-col gap-2.5">
        {items.map((song) => {
          const semitones = transpositions[song.id] ?? 0;
          return (
            <SortableSongItem
              key={song.id}
              song={song}
              position={playlist.songIds.indexOf(song.id) + 1}
              semitones={semitones}
              displayKey={
                song.key ? getKeyFromSemitones(song.key, semitones, preferFlats) : undefined
              }
              onOpen={openSong}
              onRemove={(songId) => playlistStorage.removeSong(playlist.id, songId)}
            />
          );
        })}
      </ul>
    </SortableContext>
  );

  return (
    <>
      <PageHeader
        title={playlist.name}
        icon={missa ? Church : undefined}
        subtitle={playlistSubtitle(playlist, songs.length, ' · arraste para ordenar')}
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
              // Missa antiga, de nome livre, não tem data: parte da sugestão.
              setDraftDate(parseMissaDate(playlist.name) ?? suggestMissaDates().sunday);
              setRenaming(true);
            }}
          >
            {missa ? (
              <>
                <CalendarDays className="size-3.5" /> Mudar data
              </>
            ) : (
              <>
                <Pencil className="size-3.5" /> Renomear
              </>
            )}
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
        ) : missa ? (
          <>
            {isAdmin && <MissaDayBanner suggestions={suggestions} />}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <MissaSections
                playlist={playlist}
                editable
                renderSongs={(section) => renderSortable(sectionSongs(section))}
                onAddSong={(section) => setAdding({ section })}
                renderExtra={(section) => {
                  const group = suggestionsForSection(suggestions.groups, section.name);
                  return group ? (
                    <SuggestionsButton
                      count={group.songs.length}
                      onClick={() => setSuggesting(section)}
                    />
                  ) : null;
                }}
              />
            </DndContext>
            <SuggestionsDialog
              playlist={playlist}
              section={suggesting}
              group={
                suggesting ? suggestionsForSection(suggestions.groups, suggesting.name) : undefined
              }
              {...(suggestions.day && { day: suggestions.day })}
              songs={allSongs}
              onClose={() => setSuggesting(null)}
            />
          </>
        ) : songs.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title="Playlist vazia"
            description="Adicione as músicas do dia e arraste os cards para definir a ordem."
            action={
              <Button variant="gold" className="gap-2" onClick={() => setAdding({})}>
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
              {renderSortable(songs)}
            </DndContext>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Segure e arraste um card para mudar a ordem.
            </p>

            <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => setAdding({})}>
              <Plus className="size-4" /> Adicionar músicas
            </Button>
          </>
        )}

        {/* Adicionar músicas */}
        <SongPicker
          playlist={playlist}
          section={adding?.section}
          open={adding !== null}
          songs={allSongs}
          onPick={pickSong}
          onClose={() => setAdding(null)}
        />

        {/* Renomear (na missa, o nome é a data) */}
        <Dialog open={renaming} onOpenChange={setRenaming}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{missa ? 'Data da missa' : 'Renomear playlist'}</DialogTitle>
            </DialogHeader>
            {missa ? (
              <MissaDatePicker value={draftDate} onChange={setDraftDate} onSubmit={saveName} />
            ) : (
              <Input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
              />
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button onClick={saveName} disabled={missa && !draftDate}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

/** Playlist de outra pessoa, aberta pelo link: só leitura, mas toca e baixa o PDF. */
function SharedPlaylist({ playlist }: { playlist: Playlist }) {
  const navigate = useNavigate();
  const { songs, sectionSongs, isLoading } = usePlaylistEntries(playlist);
  const { transpositions, preferFlats } = usePreferences();
  const missa = isMissa(playlist);

  const renderList = (items: typeof songs) => (
    <ol className="flex flex-col gap-2.5">
      {items.map((song) => (
        <SharedSongItem
          key={song.id}
          song={song}
          position={playlist.songIds.indexOf(song.id) + 1}
          displayKey={
            song.key
              ? getKeyFromSemitones(song.key, transpositions[song.id] ?? 0, preferFlats)
              : undefined
          }
          onOpen={() => navigate(`/musica/${song.id}?playlist=${playlist.id}`)}
        />
      ))}
    </ol>
  );

  return (
    <>
      <PageHeader
        title={playlist.name}
        icon={missa ? Church : undefined}
        subtitle={
          missa
            ? playlistSubtitle(playlist, songs.length, '')
            : `Playlist compartilhada · ${songs.length} ${songs.length === 1 ? 'música' : 'músicas'}`
        }
        actions={<PlaylistActions playlist={playlist} songCount={songs.length} />}
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[70px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : missa ? (
          <MissaSections
            playlist={playlist}
            editable={false}
            renderSongs={(section) => renderList(sectionSongs(section))}
          />
        ) : songs.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title="Playlist vazia"
            description="Quem montou ainda não adicionou músicas."
          />
        ) : (
          renderList(songs)
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
