import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ChevronLeft, ChevronRight, AlertCircle, PenLine } from 'lucide-react';
import { useSong } from '@/hooks/useSong';
import { useTranspose } from '@/hooks/useTranspose';
import { useFontSize } from '@/hooks/useFontSize';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useHistory } from '@/hooks/useHistory';
import { usePreferences } from '@/hooks/usePreferences';
import { usePlaylistNav } from '@/hooks/usePlaylistNav';
import { SongHeader } from '@/components/song/SongHeader';
import { SongRenderer } from '@/components/song/SongRenderer';
import { ReaderControls } from '@/components/song/ReaderControls';
import { StageMode } from '@/components/song/StageMode';
import { AddToPlaylist } from '@/components/playlist/AddToPlaylist';
import { Button } from '@/components/ui/button';
import { songService } from '@/services/song-service';

export function SongPage() {
  const params = useParams();
  const songId = params['*'] ?? '';
  const navigate = useNavigate();

  const { song, isLoading: isParsing, parseSong } = useSong();
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [stageOpen, setStageOpen] = useState(false);

  // Passar o songId faz o tom ser salvo e restaurado por música.
  const transpose = useTranspose(song, songId);
  const font = useFontSize();
  const { autoScrollSpeed } = usePreferences();
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScroll = useAutoScroll(scrollRef, autoScrollSpeed);

  const { record } = useHistory();
  const playlistNav = usePlaylistNav(songId);

  // Carrega e parseia a música
  useEffect(() => {
    if (!songId) {
      setFetchError('Música não especificada.');
      setIsFetching(false);
      return;
    }
    let mounted = true;
    setIsFetching(true);
    setFetchError(null);

    songService
      .getSongContent(songId)
      .then((content) => {
        if (!mounted) return;
        parseSong(content);
        record(songId);
      })
      .catch(() => {
        if (mounted) setFetchError('Não foi possível carregar a música.');
      })
      .finally(() => {
        if (mounted) setIsFetching(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // Título do documento
  useEffect(() => {
    if (song?.metadata.title) {
      document.title = `${song.metadata.title} — Minha Biblioteca de Cifras`;
    }
    return () => {
      document.title = 'Minha Biblioteca de Cifras';
    };
  }, [song?.metadata.title]);

  if (isFetching || isParsing) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-muted-foreground">
        <span className="animate-pulse">Carregando música…</span>
      </div>
    );
  }

  if (fetchError || !transpose.transposedSong) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{fetchError ?? 'Erro ao renderizar a música.'}</p>
        <Button variant="secondary" onClick={() => navigate('/')} className="gap-2">
          <ChevronLeft className="size-4" /> Voltar à biblioteca
        </Button>
      </div>
    );
  }

  const { transposedSong } = transpose;
  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Barra superior */}
      <header className="glass-panel z-[var(--z-sticky)] flex items-center justify-between gap-2 border-b border-border px-3 py-2 safe-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
          <ChevronLeft />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-foreground">
            {transposedSong.metadata.title}
          </p>
          {playlistNav ? (
            <p className="truncate text-xs text-primary">
              {playlistNav.playlistName} · {playlistNav.position}/{playlistNav.total}
            </p>
          ) : (
            transposedSong.metadata.artist && (
              <p className="truncate text-xs text-muted-foreground">
                {transposedSong.metadata.artist}
              </p>
            )
          )}
        </div>
        <AddToPlaylist songId={songId} />

        {/* Atalho para corrigir a cifra (o editor carrega pelo id da URL). */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/editor/${songId}`)}
          aria-label="Corrigir esta cifra no editor"
          title="Corrigir esta cifra"
        >
          <PenLine />
        </Button>
      </header>

      {/* Corpo rolável */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl pb-32">
          <SongHeader
            metadata={transposedSong.metadata}
            displayedKey={transpose.currentKey}
            capo={transpose.capo}
          />
          <SongRenderer song={transposedSong} fontSize={font.fontSize} />

          {/* Navegação do setlist */}
          {playlistNav && (
            <nav className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-5">
              {playlistNav.prevHref ? (
                <Button asChild variant="secondary" className="gap-1.5">
                  <Link to={playlistNav.prevHref}>
                    <ChevronLeft className="size-4" /> Anterior
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {playlistNav.nextHref ? (
                <Button asChild className="gap-1.5">
                  <Link to={playlistNav.nextHref}>
                    Próxima <ChevronRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <Link to={`/playlists/${playlistNav.playlistId}`}>Fim do setlist</Link>
                </Button>
              )}
            </nav>
          )}
        </div>
      </div>

      {/* Controles fixos */}
      <ReaderControls
        transpose={transpose}
        font={font}
        autoScroll={autoScroll}
        onEnterStage={() => setStageOpen(true)}
      />

      {/* Modo apresentação */}
      {stageOpen && (
        <StageMode
          song={transposedSong}
          title={transposedSong.metadata.title}
          transpose={transpose}
          font={font}
          onExit={() => setStageOpen(false)}
        />
      )}
    </div>
  );
}
