import { useEffect, useRef } from 'react';
import { X, Play, Pause, Minus, Plus } from 'lucide-react';
import type { Song } from '@/types/song';
import { Button } from '@/components/ui/button';
import { SongRenderer } from './SongRenderer';
import { TransposeControl } from './TransposeControl';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useWakeLock } from '@/hooks/useWakeLock';
import type { UseTransposeResult } from '@/hooks/useTranspose';
import type { UseFontSizeResult } from '@/hooks/useFontSize';

interface StageModeProps {
  song: Song;
  title: string;
  transpose: UseTransposeResult;
  font: UseFontSizeResult;
  onExit: () => void;
}

/**
 * Modo apresentação (palco): tela cheia, fonte grande, alto contraste,
 * rolagem automática e a tela sempre acesa. Sai com Esc.
 */
export function StageMode({ song, title, transpose, font, onExit }: StageModeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScroll = useAutoScroll(scrollRef, 1);
  useWakeLock(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowUp') transpose.transposeUp();
      else if (e.key === 'ArrowDown') transpose.transposeDown();
      else if (e.key === ' ') {
        e.preventDefault();
        autoScroll.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, transpose, autoScroll]);

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-[var(--color-surface)] stage-mode animate-fade-in">
      {/* Barra superior mínima */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 safe-top">
        <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        <Button variant="ghost" size="icon" onClick={onExit} aria-label="Sair do modo apresentação">
          <X />
        </Button>
      </div>

      {/* Corpo rolável */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 md:px-16">
        <div className="mx-auto max-w-4xl">
          <SongRenderer song={song} fontSize={font.fontSize + 6} />
          <div className="h-[40vh]" aria-hidden />
        </div>
      </div>

      {/* Controles flutuantes */}
      <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-3 safe-bottom">
        <TransposeControl
          semitones={transpose.semitones}
          currentKey={transpose.currentKey}
          onUp={transpose.transposeUp}
          onDown={transpose.transposeDown}
          onReset={transpose.reset}
        />
        <div className="flex items-center gap-1 rounded-xl border border-border bg-[var(--color-surface-container-high)] p-1">
          <Button variant="ghost" size="icon-sm" onClick={font.decrease} aria-label="Diminuir fonte">
            <Minus />
          </Button>
          <span className="min-w-8 text-center text-sm font-semibold">{font.fontSize + 6}</span>
          <Button variant="ghost" size="icon-sm" onClick={font.increase} aria-label="Aumentar fonte">
            <Plus />
          </Button>
        </div>
        <Button
          variant={autoScroll.isScrolling ? 'default' : 'secondary'}
          size="icon"
          onClick={autoScroll.toggle}
          aria-label="Rolagem automática"
        >
          {autoScroll.isScrolling ? <Pause /> : <Play />}
        </Button>
      </div>
    </div>
  );
}
