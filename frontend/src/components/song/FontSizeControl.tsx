import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FontSizeControlProps {
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
  className?: string;
}

/** Controle A− / A+ do tamanho da fonte da letra. */
export function FontSizeControl({
  fontSize,
  onIncrease,
  onDecrease,
  canIncrease,
  canDecrease,
  className,
}: FontSizeControlProps) {
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
        onClick={onDecrease}
        disabled={!canDecrease}
        aria-label="Diminuir fonte"
      >
        <Minus />
      </Button>
      <span className="min-w-10 text-center text-sm font-semibold text-foreground">
        {fontSize}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onIncrease}
        disabled={!canIncrease}
        aria-label="Aumentar fonte"
      >
        <Plus />
      </Button>
    </div>
  );
}
