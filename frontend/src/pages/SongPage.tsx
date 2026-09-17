import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  PenLine,
  FileDown,
  Loader2,
  Youtube,
} from 'lucide-react';
import { useSong } from '@/hooks/useSong';
import { useTranspose } from '@/hooks/useTranspose';
import { useFontSize } from '@/hooks/useFontSize';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useHistory } from '@/hooks/useHistory';
import { usePreferences } from '@/hooks/usePreferences';
import { usePlaylistNav } from '@/hooks/usePlaylistNav';
import { useEditAccess } from '@/hooks/useEditAccess';
import { useSwipe } from '@/hooks/useSwipe';
import { useReaderShortcuts } from '@/hooks/useReaderShortcuts';
import { preferencesStorage } from '@/lib/storage/preferences';
import { SongHeader } from '@/components/song/SongHeader';
import { SongRenderer } from '@/components/song/SongRenderer';
import { ReaderControls } from '@/components/song/ReaderControls';
import { StageMode } from '@/components/song/StageMode';
import { AddToPlaylist } from '@/components/playlist/AddToPlaylist';
import { FavoriteButton } from '@/components/library/FavoriteButton';
import { VideoDock } from '@/components/video/VideoDock';
import { VideoLinkDialog } from '@/components/video/VideoLinkDialog';
import { Button } from '@/components/ui/button';
import { songService } from '@/services/song-service';
import { setYoutubeInSource } from '@/lib/youtube';
import { cn } from '@/lib/utils';

export function SongPage() {
  const params = useParams();
  const songId = params['*'] ?? '';
  const navigate = useNavigate();

  const { song, isLoading: isParsing, parseSong } = useSong();
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [stageOpen, setStageOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Player acoplado aberto (só quando a música tem vídeo). */
  const [videoOpen, setVideoOpen] = useState(false);
  /** Diálogo de adicionar/trocar o vídeo. */
  const [videoEditing, setVideoEditing] = useState(false);

  // Passar o songId faz o tom ser salvo e restaurado por música.
  const transpose = useTranspose(song, songId);
  const font = useFontSize();
  const { autoScrollSpeed, readerTwoColumns } = usePreferences();
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScroll = useAutoScroll(scrollRef, autoScrollSpeed);

  const { record } = useHistory();
  const playlistNav = usePlaylistNav(songId);
  const { showEditUI, canEdit } = useEditAccess();

  // Trocar de música (anterior/próxima do setlist) fecha o vídeo da anterior.
  useEffect(() => {
    setVideoOpen(false);
  }, [songId]);

  // Impede a tela de apagar enquanto a cifra está aberta para leitura.
  useWakeLock(!isFetching && !isParsing && !fetchError);

  // Teclado (tablet/notebook na estante). Desligado enquanto o palco está
  // aberto: lá o StageMode assume, senão as duas telas responderiam juntas.
  useReaderShortcuts({
    enabled: !stageOpen,
    onTransposeUp: transpose.transposeUp,
    onTransposeDown: transpose.transposeDown,
    onToggleScroll: autoScroll.toggle,
    onFontIncrease: font.increase,
    onFontDecrease: font.decrease,
    onStage: () => setStageOpen(true),
    onExit: () => navigate(playlistNav ? `/playlists/${playlistNav.playlistId}` : '/home'),
  });

  /** Exporta a cifra no tom atual em PDF (jsPDF carregado sob demanda). */
  const handleExportPdf = async () => {
    if (!transpose.transposedSong) return;
    setExporting(true);
    try {
      const { exportSongToPdf } = await import('@/lib/export/pdf');
      await exportSongToPdf(transpose.transposedSong);
    } catch (e) {
      console.error('Falha ao exportar PDF:', e);
    } finally {
      setExporting(false);
    }
  };

  // Numa playlist, arrastar o dedo troca de música: ← próxima, → anterior.
  const swipe = useSwipe({
    onSwipeLeft: () => {
      if (playlistNav?.nextHref) navigate(playlistNav.nextHref);
    },
    onSwipeRight: () => {
      if (playlistNav?.prevHref) navigate(playlistNav.prevHref);
    },
  });

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

  // Guarda a velocidade calibrada para valer nas próximas músicas.
  useEffect(() => {
    preferencesStorage.update({ autoScrollSpeed: autoScroll.speed });
  }, [autoScroll.speed]);

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
        <Button variant="secondary" onClick={() => navigate('/home')} className="gap-2">
          <ChevronLeft className="size-4" /> Voltar à biblioteca
        </Button>
      </div>
    );
  }

  const { transposedSong } = transpose;
  const videoId = transposedSong.metadata.youtube;

  /** Sem vídeo, o botão leva a achar um; com vídeo, abre/fecha o player. */
  const handleVideoButton = () => {
    if (videoId) setVideoOpen((open) => !open);
    else setVideoEditing(true);
  };

  /** Grava só a linha `youtube:` do .cho e recarrega a música. */
  const saveVideo = async (id: string | undefined) => {
    const source = await songService.getSongContent(songId);
    const next = setYoutubeInSource(source, id);
    await songService.saveSong({ id: songId, source: next });
    parseSong(next);
    setVideoOpen(Boolean(id));
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Barra superior — some durante a rolagem automática, para sobrar tela. */}
      {!autoScroll.isScrolling && (
        <header className="safe-top z-[var(--z-sticky)] shrink-0 border-b border-white/10 bg-[image:var(--gradient-blue)] text-ivory">
          <div className="flex items-center justify-between gap-1 px-2 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(playlistNav ? `/playlists/${playlistNav.playlistId}` : '/home')}
              aria-label="Voltar"
              className="text-navy-100 hover:bg-white/10 hover:text-ivory"
            >
              <ChevronLeft />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="font-display truncate text-lg text-ivory">
                {transposedSong.metadata.title}
              </p>
              {playlistNav ? (
                <p className="truncate text-xs font-semibold text-gold-300">
                  {playlistNav.playlistName} · {playlistNav.position}/{playlistNav.total}
                </p>
              ) : (
                transposedSong.metadata.artist && (
                  <p className="truncate text-xs text-navy-200">{transposedSong.metadata.artist}</p>
                )
              )}
            </div>
            <FavoriteButton songId={songId} onDark />
            <AddToPlaylist songId={songId} onDark />

            {/* Vídeo da música: o logo fica vermelho quando há vídeo salvo. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVideoButton}
              aria-pressed={videoId ? videoOpen : undefined}
              aria-label={videoId ? (videoOpen ? 'Fechar o vídeo' : 'Ver o vídeo') : 'Adicionar vídeo'}
              title={videoId ? 'Vídeo da música' : 'Adicionar vídeo'}
              className={cn(
                'text-navy-100 hover:bg-white/10 hover:text-ivory',
                videoOpen && 'bg-white/10',
              )}
            >
              <Youtube className={cn(videoId && 'text-[#ff4e45]')} />
            </Button>

            {/* Exportar a cifra (no tom atual) em PDF. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleExportPdf()}
              disabled={exporting}
              aria-label="Exportar em PDF"
              title="Exportar em PDF"
              className="text-navy-100 hover:bg-white/10 hover:text-ivory"
            >
              {exporting ? <Loader2 className="animate-spin" /> : <FileDown />}
            </Button>

            {/* Atalho para corrigir a cifra (o editor carrega pelo id da URL). */}
            {showEditUI && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/editor/${songId}`)}
                aria-label="Corrigir esta cifra no editor"
                title="Corrigir esta cifra"
                className="text-navy-100 hover:bg-white/10 hover:text-ivory"
              >
                <PenLine />
              </Button>
            )}
          </div>
        </header>
      )}

      {/* Corpo rolável (swipe lateral troca de música na playlist) */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-8"
        onTouchStart={swipe.onTouchStart}
        onTouchEnd={swipe.onTouchEnd}
      >
        <div
          key={songId}
          className={cn(
            // Em duas colunas a coluna de texto dobra: sem alargar o
            // contêiner, cada uma ficaria estreita demais para caber a frase.
            'mx-auto pb-32 animate-slide-in-x',
            readerTwoColumns ? 'max-w-3xl lg:max-w-6xl' : 'max-w-3xl',
          )}
        >
          <SongHeader
            metadata={transposedSong.metadata}
            displayedKey={transpose.currentKey}
            capo={transpose.capo}
          />
          <SongRenderer
            song={transposedSong}
            fontSize={font.fontSize}
            twoColumns={readerTwoColumns}
          />

          {/* Navegação do setlist */}
          {playlistNav && (
            <nav className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6">
              {playlistNav.prevHref ? (
                <Button asChild variant="outline" className="gap-1.5">
                  <Link to={playlistNav.prevHref}>
                    <ChevronLeft className="size-4" /> Anterior
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {playlistNav.nextHref ? (
                <Button asChild variant="gold" className="gap-1.5">
                  <Link to={playlistNav.nextHref}>
                    Próxima <ChevronRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
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

      {/* Vídeo: fora do cabeçalho, que some na rolagem automática — o player
          não pode ser desmontado (e parar) quando a rolagem começa. */}
      {videoOpen && videoId && (
        <VideoDock
          videoId={videoId}
          title={transposedSong.metadata.title}
          onClose={() => setVideoOpen(false)}
          onEdit={canEdit ? () => setVideoEditing(true) : undefined}
        />
      )}
      <VideoLinkDialog
        open={videoEditing}
        onOpenChange={setVideoEditing}
        title={transposedSong.metadata.title}
        artist={transposedSong.metadata.artist}
        videoId={videoId}
        canEdit={canEdit}
        onSave={saveVideo}
      />

      {/* Modo apresentação */}
      {stageOpen && (
        <StageMode
          song={transposedSong}
          title={transposedSong.metadata.title}
          transpose={transpose}
          onExit={() => setStageOpen(false)}
        />
      )}
    </div>
  );
}
