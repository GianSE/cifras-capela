import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { Play, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { youtubeThumbnailUrl } from '@/lib/youtube';
import { VideoDialog } from './VideoDialog';

interface VideoButtonProps {
  videoId: string;
  title: string;
  /**
   * `thumbnail`: miniatura redonda com play (no lugar do ícone da música, na
   * biblioteca). `icon`: botão compacto com o logo (cards da playlist).
   */
  variant?: 'thumbnail' | 'icon';
  className?: string;
}

/**
 * Abre o vídeo da música a partir de um card.
 *
 * Os cards são clicáveis inteiros (link, ou item arrastável na playlist), e o
 * diálogo — mesmo em portal — propaga eventos pela árvore do React até eles.
 * Por isso tudo aqui para a propagação: sem isso, tocar no player abriria a
 * música ou começaria a arrastar o card.
 */
export function VideoButton({ videoId, title, variant = 'icon', className }: VideoButtonProps) {
  const [open, setOpen] = useState(false);

  const stop = (e: SyntheticEvent) => e.stopPropagation();
  const openPlayer = (e: SyntheticEvent) => {
    // Dentro de um <a>, o clique no botão também seguiria o link.
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  let trigger: ReactNode;
  if (variant === 'thumbnail') {
    trigger = (
      <button
        type="button"
        onClick={openPlayer}
        aria-label={`Ver o vídeo de ${title}`}
        title="Ver o vídeo"
        className={cn(
          'group/video relative size-11 shrink-0 overflow-hidden rounded-full bg-navy-700 ring-1 ring-gold-400/40 transition-shadow hover:ring-2 hover:ring-gold-400',
          className,
        )}
      >
        <img
          src={youtubeThumbnailUrl(videoId)}
          alt=""
          loading="lazy"
          decoding="async"
          // A miniatura 16:9 tem faixas pretas em cima e embaixo: ampliar
          // um pouco tira as faixas do círculo.
          className="size-full scale-[1.35] object-cover"
        />
        <span className="absolute inset-0 grid place-items-center bg-navy-950/35 transition-colors group-hover/video:bg-navy-950/15">
          <span className="grid size-6 place-items-center rounded-full bg-white/95 text-navy-900 shadow-soft">
            <Play className="size-3.5 translate-x-px fill-current" />
          </span>
        </span>
      </button>
    );
  } else {
    trigger = (
      <button
        type="button"
        onClick={openPlayer}
        aria-label={`Ver o vídeo de ${title}`}
        title="Ver o vídeo"
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-[#e62117] transition-colors hover:bg-[color-mix(in_srgb,#e62117_10%,transparent)] dark:text-[#ff4e45]',
          className,
        )}
      >
        <Youtube className="size-5" />
      </button>
    );
  }

  return (
    <span
      className="contents"
      onClick={stop}
      onPointerDown={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      onKeyDown={stop}
    >
      {trigger}
      <VideoDialog videoId={videoId} title={title} open={open} onOpenChange={setOpen} />
    </span>
  );
}
