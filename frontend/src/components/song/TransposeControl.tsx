import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TransposeControlProps {
  semitones: number;
  /** Tonalidade exibida (mostrada no centro quando disponível). */
  currentKey?: string;
  onUp: () => void;
  onDown: () => void;
  onReset: () => void;
  className?: string;
}

/**
 * Controle segmentado de transposição: `[ − ]  Tom / ±n  [ + ]`.
 * Toca todos os acordes; a letra permanece igual.
 */
export function TransposeControl({
  semitones,
  currentKey,
  onUp,
  onDown,
  onReset,
  className,
}: TransposeControlProps) {
  const label = semitones === 0 ? '0' : semitones > 0 ? `+${semitones}` : `${semitones}`;

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-xl border border-border bg-[var(--color-surface-container-high)] p-1',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDown}
        aria-label="Baixar meio tom"
        title="Baixar meio tom (−1)"
      >
        <Minus />
      </Button>

      <button
        type="button"
        onClick={onReset}
        title="Voltar ao tom original"
        className="flex min-w-16 flex-col items-center px-2 leading-none"
      >
        <span className="font-mono text-lg font-semibold tracking-wide text-accent">
          {currentKey ?? label}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          {semitones !== 0 && (
            <>
              <RotateCcw className="size-2.5" /> {label}
            </>
          )}
          {semitones === 0 && 'tom'}
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onUp}
        aria-label="Subir meio tom"
        title="Subir meio tom (+1)"
      >
        <Plus />
      </Button>
    </div>
  );
}
