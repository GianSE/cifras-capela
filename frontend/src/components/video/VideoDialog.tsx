import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { youtubeEmbedUrl, youtubeWatchUrl } from '@/lib/youtube';

interface VideoDialogProps {
  videoId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Player em janela, aberto a partir dos cards (biblioteca e playlist): ali a
 * pessoa só quer lembrar como a música é, não ler a cifra junto.
 *
 * O `<iframe>` só existe com a janela aberta — fechar para o vídeo, e a lista
 * não carrega um player por card.
 */
export function VideoDialog({ videoId, title, open, onOpenChange }: VideoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        {/* Título em cima: o X do diálogo fica sobre a faixa, não sobre o vídeo. */}
        <div className="flex min-h-14 items-center gap-2 py-2 pl-4 pr-12">
          <DialogTitle className="font-display min-w-0 flex-1 truncate text-lg">
            {title}
          </DialogTitle>
          <a
            href={youtubeWatchUrl(videoId)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[var(--color-surface-hover)] hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            <span className="hidden sm:inline">Abrir no YouTube</span>
            <span className="sm:hidden">YouTube</span>
          </a>
        </div>
        <div className="aspect-video w-full bg-black">
          {open && (
            <iframe
              src={youtubeEmbedUrl(videoId)}
              title={`Vídeo: ${title}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="size-full"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
