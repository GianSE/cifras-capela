import type { Chord } from '@/types/song';
import { cn } from '@/lib/utils';

interface ChordBadgeProps {
  chord: Chord;
  className?: string;
}

/**
 * Exibe um acorde na cifra.
 *
 * Renderiza `chord.raw` — a forma canônica, reconstruída pela transposição —
 * em **tamanho uniforme**, como manda a notação de cifra brasileira (`A7`,
 * `Bm7(b5)`, `G/B`). Nada de sobrescrito: além de prejudicar a leitura à
 * distância no palco, deixaria a tela diferente do PDF, que também usa `raw`.
 */
export function ChordBadge({ chord, className }: ChordBadgeProps) {
  return <span className={cn('chord-badge', className)}>{chord.raw}</span>;
}
