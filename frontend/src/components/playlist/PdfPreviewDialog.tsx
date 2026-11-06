import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, Minus, Music, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadBlob } from '@/lib/export/download';
import { cn } from '@/lib/utils';

export interface PdfChoice {
  readonly lyricsOnly: boolean;
  readonly toc: boolean;
  /** Músicas dividem a folha; desligado, cada uma começa numa folha nova. */
  readonly together: boolean;
  readonly columns: 1 | 2;
  /** Tamanho da letra: 1 é o de sempre. */
  readonly fontScale: number;
}

export const FONT_SCALE_STEP = 0.1;
export const FONT_SCALE_RANGE = [0.8, 1.6] as const;

const DEFAULT_CHOICE: PdfChoice = {
  lyricsOnly: false,
  toc: true,
  together: true,
  columns: 1,
  fontScale: 1,
};

/** Arredonda para não acumular 0,1 + 0,1 + … = 1,2000000002. */
const roundScale = (value: number) =>
  Math.min(FONT_SCALE_RANGE[1], Math.max(FONT_SCALE_RANGE[0], Math.round(value * 10) / 10));

export interface GeneratedPdf {
  readonly bytes: ArrayBuffer;
  readonly filename: string;
}

const CHOICE_KEY = 'cifras-capela:pdf-escolha';

function readChoice(): PdfChoice {
  try {
    const stored = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '{}') as Partial<PdfChoice>;
    return {
      lyricsOnly: stored.lyricsOnly === true,
      toc: stored.toc !== false,
      together: stored.together !== false,
      columns: stored.columns === 2 ? 2 : 1,
      fontScale:
        typeof stored.fontScale === 'number' && Number.isFinite(stored.fontScale)
          ? roundScale(stored.fontScale)
          : 1,
    };
  } catch {
    return DEFAULT_CHOICE;
  }
}

function saveChoice(choice: PdfChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
  } catch {
    // Sem armazenamento, a escolha vale até fechar.
  }
}

type PreviewState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly pdf: GeneratedPdf;
      readonly pages: readonly string[];
    }
  | { readonly status: 'error' };

/**
 * Antes de baixar, a prévia: as páginas do PDF de verdade, do jeito que vão sair.
 * Qualquer opção (cifras ou letra, sumário, juntar as músicas, colunas, tamanho da
 * letra) refaz a prévia na hora, e o botão baixa exatamente o arquivo da tela.
 */
export function PdfPreviewDialog({
  open,
  onOpenChange,
  title,
  generate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  generate: (choice: PdfChoice) => Promise<GeneratedPdf>;
}) {
  const [choice, setChoice] = useState<PdfChoice>(readChoice);
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  /** Só a última geração vale: trocar a opção no meio descarta a anterior. */
  const generation = useRef(0);

  useEffect(() => {
    if (!open) return;
    const current = ++generation.current;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const pdf = await generate(choice);
        const { renderPdfToImages } = await import('@/lib/pdf-render');
        const pages = await renderPdfToImages(pdf.bytes, { scale: 1.4, quality: 0.8 });
        if (current === generation.current) {
          setState({ status: 'ready', pdf, pages: pages.map((p) => p.data) });
        }
      } catch (e) {
        console.error('Falha ao gerar a prévia do PDF:', e);
        if (current === generation.current) setState({ status: 'error' });
      }
    })();
  }, [open, choice, generate]);

  const update = (patch: Partial<PdfChoice>) => {
    const next = { ...choice, ...patch };
    setChoice(next);
    saveChoice(next);
  };

  const download = () => {
    if (state.status !== 'ready') return;
    downloadBlob(state.pdf.filename, new Blob([state.pdf.bytes], { type: 'application/pdf' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-3xl flex-col gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Exportar PDF</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="radiogroup"
            aria-label="Conteúdo do PDF"
            className="flex rounded-full border border-[var(--color-outline)] p-0.5"
          >
            {(
              [
                [false, 'Com cifras', Music],
                [true, 'Só a letra', FileText],
              ] as const
            ).map(([lyricsOnly, label, Icon]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={choice.lyricsOnly === lyricsOnly}
                onClick={() => update({ lyricsOnly })}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-colors',
                  choice.lyricsOnly === lyricsOnly
                    ? 'bg-navy-700 text-gold-300'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Tamanho da letra"
            className="flex items-center gap-1 rounded-full border border-[var(--color-outline)] p-0.5"
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Letra menor"
              disabled={choice.fontScale <= FONT_SCALE_RANGE[0]}
              onClick={() => update({ fontScale: roundScale(choice.fontScale - FONT_SCALE_STEP) })}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="min-w-[3.25rem] text-center text-xs font-semibold text-foreground">
              Letra {Math.round(choice.fontScale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Letra maior"
              disabled={choice.fontScale >= FONT_SCALE_RANGE[1]}
              onClick={() => update({ fontScale: roundScale(choice.fontScale + FONT_SCALE_STEP) })}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Switch checked={choice.toc} onCheckedChange={(toc) => update({ toc })} />
            Sumário
          </label>
          <label
            className="flex items-center gap-2 text-sm font-medium text-foreground"
            title="Desligado, cada música começa numa folha nova"
          >
            <Switch
              checked={choice.together}
              onCheckedChange={(together) => update({ together })}
            />
            Juntar músicas
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Switch
              checked={choice.columns === 2}
              onCheckedChange={(two) => update({ columns: two ? 2 : 1 })}
            />
            Duas colunas
          </label>
        </div>

        <div
          aria-label="Prévia do PDF"
          aria-busy={state.status === 'loading'}
          className="min-h-48 flex-1 overflow-y-auto rounded-xl bg-[var(--color-surface-container-high)] p-3"
        >
          {state.status === 'loading' && (
            <p className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Montando o PDF…
            </p>
          )}
          {state.status === 'error' && (
            <p
              role="alert"
              className="flex h-48 items-center justify-center text-sm text-destructive"
            >
              Não foi possível montar o PDF. Tente de novo.
            </p>
          )}
          {state.status === 'ready' && (
            <div className="mx-auto flex max-w-xl flex-col gap-3">
              {state.pages.map((page, index) => (
                <figure key={index} className="flex flex-col items-center gap-1">
                  <img
                    src={page}
                    alt={`Página ${index + 1} de ${state.pages.length}`}
                    className="w-full rounded-md bg-white shadow-soft"
                  />
                  <figcaption className="text-xs text-muted-foreground">
                    {index + 1} / {state.pages.length}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {state.status === 'ready'
              ? `${state.pages.length} ${state.pages.length === 1 ? 'página' : 'páginas'}`
              : ''}
          </p>
          <Button onClick={download} disabled={state.status !== 'ready'} className="gap-1.5">
            <Download className="size-4" /> Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
