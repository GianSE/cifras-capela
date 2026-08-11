import { useRef } from 'react';
import { X, Play, Pause, Minus, Plus } from 'lucide-react';
import type { Song } from '@/types/song';
import { Button } from '@/components/ui/button';
import { SongRenderer } from './SongRenderer';
import { TransposeControl } from './TransposeControl';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useWakeLock } from '@/hooks/useWakeLock';
import { usePreferences } from '@/hooks/usePreferences';
import { useReaderShortcuts } from '@/hooks/useReaderShortcuts';
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
 *
 * Vai **sempre** na "noite de Fátima" (azul profundo + acordes dourados),
 * mesmo com o app no tema claro: no palco, tela clara ofusca quem toca. A
 * classe `dark` na raiz redeclara os tokens só dentro desta tela.
 */
export function StageMode({ song, title, transpose, font, onExit }: StageModeProps) {
  const { readerTwoColumns: twoColumns } = usePreferences();
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScroll = useAutoScroll(scrollRef, 1);
  useWakeLock(true);

  // Mesmos atalhos do leitor — é o mesmo gesto, com ou sem o palco aberto.
  useReaderShortcuts({
    onTransposeUp: transpose.transposeUp,
    onTransposeDown: transpose.transposeDown,
    onToggleScroll: autoScroll.toggle,
    onFontIncrease: font.increase,
    onFontDecrease: font.decrease,
    onExit,
  });

  return (
    <div className="dark stage-mode fixed inset-0 z-[var(--z-modal)] flex flex-col bg-background text-foreground animate-fade-in">
      {/* Barra superior mínima */}
      <div className="safe-top flex items-center justify-between gap-3 border-b border-gold-400/25 px-4 py-2">
        <h2 className="font-display truncate text-xl text-ivory">{title}</h2>
        <Button variant="ghost" size="icon" onClick={onExit} aria-label="Sair do modo apresentação">
          <X />
        </Button>
      </div>

      {/* Corpo rolável */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 md:px-16">
        <div className={twoColumns ? 'mx-auto max-w-7xl' : 'mx-auto max-w-4xl'}>
          <SongRenderer song={song} fontSize={font.fontSize + 6} twoColumns={twoColumns} />
          <div className="h-[40vh]" aria-hidden />
        </div>
      </div>

      {/* Controles flutuantes */}
      <div className="safe-bottom flex items-center justify-center gap-2 border-t border-gold-400/25 px-4 py-3">
        <TransposeControl
          semitones={transpose.semitones}
          currentKey={transpose.currentKey}
          onUp={transpose.transposeUp}
          onDown={transpose.transposeDown}
        />
        <div className="flex items-center gap-1 rounded-full border border-[var(--color-outline)] bg-[var(--color-surface-container-high)] p-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={font.decrease}
            aria-label="Diminuir fonte"
          >
            <Minus />
          </Button>
          <span className="min-w-8 text-center text-sm font-semibold">{font.fontSize + 6}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={font.increase}
            aria-label="Aumentar fonte"
          >
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
