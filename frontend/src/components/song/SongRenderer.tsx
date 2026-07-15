import type { Song } from '@/types/song';
import { SongSection } from './SongSection';
import { cn } from '@/lib/utils';

interface SongRendererProps {
  song: Song;
  /** Tamanho da fonte da letra em px (os acordes escalam junto). */
  fontSize?: number;
  className?: string;
}

/**
 * Renderiza o corpo da cifra: seções com acordes posicionados acima da letra.
 * O `fontSize` controla a escala de toda a área (letra + acordes).
 */
export function SongRenderer({ song, fontSize = 18, className }: SongRendererProps) {
  return (
    <article
      className={cn('font-lyrics leading-relaxed', className)}
      style={{ fontSize: `${fontSize}px` }}
    >
      {song.sections.map((section, index) => (
        <SongSection key={index} section={section} />
      ))}
    </article>
  );
}
