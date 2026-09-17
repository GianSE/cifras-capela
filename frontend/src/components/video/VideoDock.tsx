import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Pencil, X, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { youtubeEmbedUrl, youtubeWatchUrl } from '@/lib/youtube';

interface VideoDockProps {
  videoId: string;
  title: string;
  onClose: () => void;
  /** Trocar/remover o vídeo — só para quem pode editar. */
  onEdit?: () => void;
}

const ICON_BUTTON =
  'grid size-8 shrink-0 place-items-center rounded-full text-navy-100 transition-colors hover:bg-white/10 hover:text-ivory';

/**
 * Player preso à tela do leitor, para ouvir **enquanto lê** a cifra.
 *
 * - Celular: faixa larga logo acima dos controles do leitor.
 * - Tablet/desktop: cartão no canto inferior direito.
 *
 * Minimizar recolhe só a imagem: o `<iframe>` continua montado (com altura
 * zero), então a música segue tocando e a cifra fica livre.
 */
export function VideoDock({ videoId, title, onClose, onEdit }: VideoDockProps) {
  const [minimized, setMinimized] = useState(false);

  return (
    <section
      aria-label="Vídeo da música"
      className={cn(
        'fixed inset-x-3 bottom-[5.5rem] z-[var(--z-sticky)] overflow-hidden rounded-2xl border border-gold-400/40 bg-navy-900 shadow-floating animate-scale-in',
        'md:inset-x-auto md:bottom-24 md:right-4 md:w-[22rem]',
        'safe-bottom',
      )}
    >
      <div className="flex items-center gap-1 py-1 pl-3 pr-1 text-ivory">
        <Youtube className="size-4 shrink-0 text-[#ff4e45]" aria-hidden />
        <p className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold">{title}</p>

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className={ICON_BUTTON}
            aria-label="Trocar o vídeo"
            title="Trocar o vídeo"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        <a
          href={youtubeWatchUrl(videoId)}
          target="_blank"
          rel="noreferrer noopener"
          className={ICON_BUTTON}
          aria-label="Abrir no YouTube"
          title="Abrir no YouTube"
        >
          <ExternalLink className="size-4" />
        </a>
        <button
          type="button"
          onClick={() => setMinimized((v) => !v)}
          className={ICON_BUTTON}
          aria-expanded={!minimized}
          aria-label={minimized ? 'Mostrar o vídeo' : 'Minimizar o vídeo'}
          title={minimized ? 'Mostrar o vídeo' : 'Minimizar (continua tocando)'}
        >
          {minimized ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={ICON_BUTTON}
          aria-label="Fechar o vídeo"
          title="Fechar o vídeo"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className={cn('w-full bg-black', minimized ? 'h-0' : 'aspect-video')}>
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={`Vídeo: ${title}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>
    </section>
  );
}
