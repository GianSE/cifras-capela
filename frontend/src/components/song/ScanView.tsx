import { useEffect, useState } from 'react';
import { ImageOff, Loader2, Minus, Pause, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UseAutoScrollResult } from '@/hooks/useAutoScroll';
import { loadScanForView } from '@/lib/scan-images';
import { scanFileUrl } from '@/lib/scans';

const ZOOM_MIN = 100;
const ZOOM_MAX = 300;
const ZOOM_STEP = 25;

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly urls: readonly string[] }
  | { readonly status: 'error' };

/** A folha no lugar da cifra: a foto, ou as páginas do PDF uma embaixo da outra. */
export function ScanView({ scanId, title, zoom }: { scanId: string; title: string; zoom: number }) {
  const [state, setState] = useState<ViewState>({ status: 'loading' });
  /** O arquivo veio, mas o navegador não sabe desenhar (HEIC fora do Safari). */
  const [undrawable, setUndrawable] = useState(false);

  useEffect(() => {
    let active = true;
    let release = () => {};
    setState({ status: 'loading' });
    setUndrawable(false);

    loadScanForView(scanId).then(
      (loaded) => {
        if (!active) {
          loaded.release();
          return;
        }
        release = loaded.release;
        setState({ status: 'ready', urls: loaded.urls });
      },
      () => {
        if (active) setState({ status: 'error' });
      },
    );

    return () => {
      active = false;
      release();
    };
  }, [scanId]);

  if (state.status === 'loading') {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Abrindo a folha…
      </p>
    );
  }

  if (state.status === 'error' || undrawable) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ImageOff className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {undrawable
            ? 'Este aparelho não consegue mostrar esta foto aqui.'
            : 'Não foi possível abrir a folha. Sem internet, só abre a que já foi vista neste aparelho.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={scanFileUrl(scanId)} target="_blank" rel="noreferrer">
            Abrir o arquivo
          </a>
        </Button>
      </div>
    );
  }

  return (
    // Ampliada, a folha rola para o lado aqui dentro, sem mexer na página.
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-3" style={{ width: `${zoom}%` }}>
        {state.urls.map((url, index) => (
          <img
            key={url.slice(-32)}
            src={url}
            alt={
              state.urls.length > 1
                ? `Folha de ${title}, página ${index + 1} de ${state.urls.length}`
                : `Folha de ${title}`
            }
            onError={() => setUndrawable(true)}
            className="w-full rounded-lg border border-border bg-white"
          />
        ))}
      </div>
    </div>
  );
}

/** Controles da folha, no lugar dos de tom e fonte, que aqui não fariam nada. */
export function ScanControls({
  zoom,
  onZoom,
  autoScroll,
}: {
  zoom: number;
  onZoom: (zoom: number) => void;
  autoScroll: UseAutoScrollResult;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-sticky)] flex justify-center px-3 pb-3 safe-bottom md:pb-4">
      <div className="glass-panel pointer-events-auto flex items-center gap-1 rounded-full border border-gold-400/40 p-1 shadow-floating">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Diminuir a folha"
          title="Diminuir"
        >
          <Minus />
        </Button>
        <span className="min-w-[52px] text-center font-mono text-sm font-semibold text-foreground">
          {zoom}%
        </span>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Ampliar a folha"
          title="Ampliar"
        >
          <Plus />
        </Button>
        <Button
          variant="gold"
          size="icon"
          onClick={autoScroll.toggle}
          aria-label={autoScroll.isScrolling ? 'Pausar a rolagem' : 'Rolar a folha'}
          title={autoScroll.isScrolling ? 'Pausar a rolagem' : 'Rolar a folha'}
        >
          {autoScroll.isScrolling ? <Pause /> : <Play />}
        </Button>
      </div>
    </div>
  );
}
