import { cn } from '@/lib/utils';

/**
 * Aparência das pastilhas de filtro da biblioteca.
 *
 * Mora fora do `CategoryFilter` porque pastilhas de fora dele (favoritas, por
 * exemplo) precisam ficar idênticas às de categoria — se cada uma montasse as
 * suas classes, a faixa desalinharia na primeira mudança.
 */
export function filterChipClass(selected: boolean, onDark?: boolean): string {
  return cn(
    'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
    'inline-flex items-center gap-1.5',
    selected
      ? 'bg-[image:var(--gradient-gold)] text-navy-900 shadow-gilded'
      : onDark
        ? 'border border-white/20 text-navy-100 hover:border-gold-400/50 hover:text-ivory'
        : 'border border-[var(--color-outline)] text-muted-foreground hover:border-gold-500 hover:text-foreground',
  );
}
