import { cn } from '@/lib/utils';

interface FilterChipsProps {
  options: readonly string[];
  active: readonly string[];
  onToggle: (value: string) => void;
  className?: string;
}

/** Chips horizontais para filtrar por categoria (rolagem horizontal no mobile). */
export function FilterChips({ options, active, onToggle, className }: FilterChipsProps) {
  if (options.length === 0) return null;

  return (
    <div
      className={cn(
        '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map((option) => {
        const isActive = active.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            aria-pressed={isActive}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-[var(--color-surface-container-high)] text-muted-foreground hover:text-foreground',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
