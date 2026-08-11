import { Maximize2, SlidersHorizontal, Play, Pause, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { SectionJump } from './SectionJump';
import type { Song } from '@/types/song';
import { usePreferences } from '@/hooks/usePreferences';
import { preferencesStorage } from '@/lib/storage/preferences';
import type { UseTransposeResult } from '@/hooks/useTranspose';
import type { UseFontSizeResult } from '@/hooks/useFontSize';
import type { UseAutoScrollResult } from '@/hooks/useAutoScroll';

interface ReaderControlsProps {
  /** Cifra em exibição — só para listar as seções do salto. */
  song: Song;
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

/** Atalhos de `useReaderShortcuts`, para quem toca com teclado na estante. */
const SHORTCUTS: Array<[keys: string[], label: string]> = [
  [['↑', '↓'], 'Meio tom'],
  [['espaço'], 'Rolagem'],
  [['+', '−'], 'Letra'],
  [['P'], 'Apresentação'],
  [['Esc'], 'Voltar'],
];

export function ReaderControls({
  song,
  transpose,
  font,
  autoScroll,
  onEnterStage,
}: ReaderControlsProps) {
  const { readerTwoColumns: twoColumns } = usePreferences();
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
        <div className="glass-panel pointer-events-auto flex items-center gap-1 rounded-full border border-gold-400/40 p-1 shadow-floating">
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
      <div className="glass-panel pointer-events-auto flex items-center gap-2 rounded-full border border-gold-400/40 p-2 shadow-floating">
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

        <SectionJump song={song} idPrefix="secao" />

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
                <div className="flex overflow-hidden rounded-full border border-[var(--color-outline)]">
                  <button
                    type="button"
                    onClick={() => !transpose.preferFlats || transpose.toggleAccidentalPreference()}
                    className={`px-4 py-2 font-mono text-sm font-semibold transition-colors ${!transpose.preferFlats ? 'bg-[image:var(--gradient-gold)] text-navy-900' : 'text-muted-foreground hover:text-foreground'}`}
                    aria-pressed={!transpose.preferFlats}
                  >
                    ♯
                  </button>
                  <button
                    type="button"
                    onClick={() => transpose.preferFlats || transpose.toggleAccidentalPreference()}
                    className={`px-4 py-2 font-mono text-sm font-semibold transition-colors ${transpose.preferFlats ? 'bg-[image:var(--gradient-gold)] text-navy-900' : 'text-muted-foreground hover:text-foreground'}`}
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

              {/* Só aparece a partir de `lg`: abaixo disso as colunas não têm
                  efeito, e o interruptor pareceria quebrado. */}
              <div className="hidden items-center justify-between gap-3 lg:flex">
                <div>
                  <p className="text-sm font-medium text-foreground">Duas colunas</p>
                  <p className="text-xs text-muted-foreground">Cabe mais na tela, rola menos.</p>
                </div>
                <Switch
                  checked={twoColumns}
                  onCheckedChange={(checked) =>
                    preferencesStorage.update({ readerTwoColumns: checked })
                  }
                />
              </div>

              <Button variant="outline" onClick={onEnterStage} className="w-full gap-2">
                <Maximize2 className="size-4" /> Modo apresentação
              </Button>

              {/* Atalhos só existem com teclado; some em aparelho de toque,
                  onde seriam uma lista inútil ocupando a tela. */}
              <div className="hidden [@media(any-hover:hover)]:block">
                <hr className="rule-gold border-0" />
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {SHORTCUTS.map(([keys, label]) => (
                    <div key={label} className="flex items-center gap-2">
                      <dt className="shrink-0">
                        {keys.map((k) => (
                          <kbd
                            key={k}
                            className="mr-1 rounded-md border border-[var(--color-outline)] bg-[var(--color-surface-container-high)] px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                          >
                            {k}
                          </kbd>
                        ))}
                      </dt>
                      <dd className="truncate">{label}</dd>
                    </div>
                  ))}
                </dl>
              </div>
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
