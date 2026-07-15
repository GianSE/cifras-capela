import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AutoScrollControlProps {
  isScrolling: boolean;
  speed: number;
  onToggle: () => void;
  onSpeedChange: (speed: number) => void;
}

const MIN = 0.25;
const MAX = 3;

/** Controle de rolagem automática: play/pause + velocidade ajustável. */
export function AutoScrollControl({
  isScrolling,
  speed,
  onToggle,
  onSpeedChange,
}: AutoScrollControlProps) {
  return (
    <div className="rounded-xl border border-border bg-[var(--color-surface-container-low)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Rolagem automática</span>
        <Button
          variant={isScrolling ? 'default' : 'secondary'}
          size="sm"
          onClick={onToggle}
          className="gap-1.5"
        >
          {isScrolling ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isScrolling ? 'Pausar' : 'Iniciar'}
        </Button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="w-14 text-xs text-muted-foreground">Velocidade</span>
        <Slider
          value={[speed]}
          min={MIN}
          max={MAX}
          step={0.25}
          onValueChange={(v) => onSpeedChange(v[0] ?? 1)}
          aria-label="Velocidade da rolagem"
        />
        <span className="w-10 text-right font-mono text-sm text-foreground">
          {speed.toFixed(2)}×
        </span>
      </div>
    </div>
  );
}
