import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  options: readonly string[];
  /** Categoria ativa (seleção única) ou null para "todas". */
  active: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

/** Menu suspenso para filtrar por categoria (seleção única, só categorias existentes). */
export function CategoryFilter({ options, active, onChange, className }: CategoryFilterProps) {
  if (options.length === 0) return null;

  return (
    <div className={cn('relative', className)}>
      <select
        value={active ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Filtrar por categoria"
        className={cn(
          'h-10 w-full appearance-none rounded-lg border border-input bg-[var(--color-surface-container-high)] px-3 py-2 pr-9 text-sm capitalize text-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent',
        )}
      >
        <option value="">Todas as categorias</option>
        {options.map((option) => (
          <option key={option} value={option} className="capitalize">
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
