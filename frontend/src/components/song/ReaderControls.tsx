import { Maximize2, SlidersHorizontal, Play, Pause, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TransposeControl } from './TransposeControl';
import { FontSizeControl } from './FontSizeControl';
import { CapoControl } from './CapoControl';
import { AutoScrollControl } from './AutoScrollControl';
import type { UseTransposeResult } from '@/hooks/useTranspose';
import type { UseFontSizeResult } from '@/hooks/useFontSize';
import type { UseAutoScrollResult } from '@/hooks/useAutoScroll';

interface ReaderControlsProps {
  transpose: UseTransposeResult;
  font: UseFontSizeResult;
  autoScroll: UseAutoScrollResult;
  onEnterStage: () => void;
}

/**
 * Barra de controles do leitor (fixa na base) + diálogo de ferramentas.
 * Reúne transposição, fonte, sustenido/bemol, capo, auto-scroll e modo palco.
 */
const SPEED_MIN = 0.1;
const SPEED_MAX = 3;
const SPEED_STEP = 0.1;

export function ReaderControls({ transpose, font, autoScroll, onEnterStage }: ReaderControlsProps) {
  const changeSpeed = (delta: number) => {
    const next = Math.min(
      SPEED_MAX,
      Math.max(SPEED_MIN, Math.round((autoScroll.speed + delta) * 10) / 10),
    );
    autoScroll.setSpeed(next);
  };

  // Enquanto rola: barra minimalista só com a velocidade (libera a tela).
  // Os detalhes (tom, tamanho, ferramentas) reaparecem ao pausar.
  if (autoScroll.isScrolling) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-sticky)] flex justify-center px-3 pb-3 safe-bottom md:pb-4">
        <div className="glass-panel pointer-events-auto flex items-center gap-1 rounded-full border border-border p-1 shadow-xl">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => changeSpeed(-SPEED_STEP)}
            disabled={autoScroll.speed <= SPEED_MIN}
            aria-label="Mais devagar"
            title="Mais devagar"
          >
            <Minus />
          </Button>
          <span
            className="min-w-[52px] text-center font-mono text-sm font-semibold text-foreground"
            title="Velocidade da rolagem"
          >
            {autoScroll.speed.toFixed(1)}×
          </span>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => changeSpeed(SPEED_STEP)}
            disabled={autoScroll.speed >= SPEED_MAX}
            aria-label="Mais rápido"
            title="Mais rápido"
          >
            <Plus />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={autoScroll.toggle}
            aria-label="Pausar rolagem"
            title="Pausar rolagem"
          >
            <Pause />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-sticky)] flex justify-center px-3 pb-3 safe-bottom md:pb-4">
      <div className="glass-panel pointer-events-auto flex items-center gap-2 rounded-2xl border border-border p-2 shadow-xl">
        <TransposeControl
          semitones={transpose.semitones}
          currentKey={transpose.currentKey}
          onUp={transpose.transposeUp}
          onDown={transpose.transposeDown}
        />

        <FontSizeControl
          fontSize={font.fontSize}
          onIncrease={font.increase}
          onDecrease={font.decrease}
          canIncrease={font.canIncrease}
          canDecrease={font.canDecrease}
          className="hidden sm:flex"
        />

        <Button
          variant={autoScroll.isScrolling ? 'default' : 'secondary'}
          size="icon"
          onClick={autoScroll.toggle}
          aria-label={autoScroll.isScrolling ? 'Pausar rolagem' : 'Iniciar rolagem'}
          title="Rolagem automática"
        >
          {autoScroll.isScrolling ? <Pause /> : <Play />}
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Ferramentas" title="Ferramentas">
              <SlidersHorizontal />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ferramentas</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Transposição + sustenido/bemol */}
              <div className="flex items-center justify-between gap-3">
                <TransposeControl
                  semitones={transpose.semitones}
                  currentKey={transpose.currentKey}
                  onUp={transpose.transposeUp}
                  onDown={transpose.transposeDown}
                />
                <div className="flex overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => !transpose.preferFlats || transpose.toggleAccidentalPreference()}
                    className={`px-3 py-2 font-mono text-sm ${!transpose.preferFlats ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    aria-pressed={!transpose.preferFlats}
                  >
                    ♯
                  </button>
                  <button
                    type="button"
                    onClick={() => transpose.preferFlats || transpose.toggleAccidentalPreference()}
                    className={`px-3 py-2 font-mono text-sm ${transpose.preferFlats ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    aria-pressed={transpose.preferFlats}
                  >
                    ♭
                  </button>
                </div>
              </div>

              {/* Fonte */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Tamanho da fonte</span>
                <FontSizeControl
                  fontSize={font.fontSize}
                  onIncrease={font.increase}
                  onDecrease={font.decrease}
                  canIncrease={font.canIncrease}
                  canDecrease={font.canDecrease}
                />
              </div>

              <CapoControl
                originalKey={transpose.originalKey}
                displayedKey={transpose.currentKey}
                capo={transpose.capo}
              />

              <AutoScrollControl
                isScrolling={autoScroll.isScrolling}
                speed={autoScroll.speed}
                onToggle={autoScroll.toggle}
                onSpeedChange={autoScroll.setSpeed}
              />

              <Button variant="outline" onClick={onEnterStage} className="w-full gap-2">
                <Maximize2 className="size-4" /> Modo apresentação
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button
          variant="secondary"
          size="icon"
          onClick={onEnterStage}
          aria-label="Modo apresentação"
          title="Modo apresentação"
          className="hidden md:inline-flex"
        >
          <Maximize2 />
        </Button>
      </div>
    </div>
  );
}
