import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Search, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseYoutubeId, youtubeSearchUrl, youtubeThumbnailUrl } from '@/lib/youtube';

interface VideoLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  artist?: string;
  /** Vídeo atual, se houver. */
  videoId?: string;
  /** Quem não pode editar só vê o atalho de busca. */
  canEdit: boolean;
  /** Grava o vídeo (`undefined` remove). Rejeita com mensagem em caso de erro. */
  onSave: (videoId: string | undefined) => Promise<void>;
}

/**
 * Adicionar, trocar ou remover o vídeo de uma música.
 *
 * O caminho é: "Procurar no YouTube" abre a busca já com título e artista,
 * copia-se o link do vídeo certo e cola aqui. A miniatura confirma que é o
 * vídeo esperado antes de salvar.
 */
export function VideoLinkDialog({
  open,
  onOpenChange,
  title,
  artist,
  videoId,
  canEdit,
  onSave,
}: VideoLinkDialogProps) {
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLink(videoId ? `https://youtu.be/${videoId}` : '');
      setError(null);
    }
  }, [open, videoId]);

  const parsed = parseYoutubeId(link);
  const invalid = link.trim() !== '' && !parsed;

  const save = async (next: string | undefined) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o vídeo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{videoId ? 'Trocar o vídeo' : 'Vídeo da música'}</DialogTitle>
          <DialogDescription>
            {canEdit
              ? 'Procure a música no YouTube, copie o link do vídeo e cole abaixo.'
              : 'Esta música ainda não tem vídeo. Dá para procurar direto no YouTube.'}
          </DialogDescription>
        </DialogHeader>

        <Button asChild variant="outline" className="gap-2">
          <a href={youtubeSearchUrl(title, artist)} target="_blank" rel="noreferrer noopener">
            <Search className="size-4" /> Procurar no YouTube
            <ExternalLink className="size-3.5 opacity-60" />
          </a>
        </Button>

        {canEdit && (
          <>
            <div>
              <Label htmlFor="video-link" className="mb-1.5 block text-sm">
                Link do vídeo
              </Label>
              <Input
                id="video-link"
                inputMode="url"
                autoComplete="off"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parsed && !saving) void save(parsed);
                }}
                placeholder="https://youtu.be/..."
                aria-invalid={invalid}
              />
              {invalid && (
                <p className="mt-1.5 text-xs text-destructive">
                  Não reconheci esse link. Use o endereço de um vídeo do YouTube.
                </p>
              )}
            </div>

            {parsed && (
              <img
                src={youtubeThumbnailUrl(parsed)}
                alt=""
                className="aspect-video w-full rounded-xl border border-border bg-muted object-cover"
              />
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {videoId && (
                <Button
                  variant="ghost"
                  className="gap-2 text-destructive hover:text-destructive sm:mr-auto"
                  disabled={saving}
                  onClick={() => void save(undefined)}
                >
                  <Trash2 className="size-4" /> Remover vídeo
                </Button>
              )}
              <Button
                className="gap-2 sm:ml-auto"
                disabled={!parsed || saving || parsed === videoId}
                onClick={() => parsed && void save(parsed)}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Salvar vídeo
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
