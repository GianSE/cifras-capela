import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Sobre a faixa azul do cabeçalho: inverte as cores para vidro claro. */
  onDark?: boolean;
  className?: string;
}

/** Campo de busca instantânea com ícone e botão de limpar. */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar por nome, artista, categoria ou letra…',
  autoFocus,
  onDark,
  className,
}: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn(
          'pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2',
          onDark ? 'text-gold-300' : 'text-muted-foreground',
        )}
      />
      <input
        type="search"
        inputMode="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar músicas"
        className={cn(
          'h-12 w-full rounded-full border pl-11 pr-11 text-sm transition-colors',
          '[&::-webkit-search-cancel-button]:hidden',
          onDark
            ? 'border-white/20 bg-white/10 text-ivory placeholder:text-navy-200 hover:border-gold-400/50 focus-visible:border-gold-400'
            : 'border-input bg-[var(--color-surface-container-lowest)] text-foreground shadow-soft placeholder:text-muted-foreground hover:border-[var(--color-outline)] focus-visible:border-gold-500',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors',
            onDark
              ? 'text-navy-200 hover:bg-white/10 hover:text-ivory'
              : 'text-muted-foreground hover:bg-[var(--color-surface-hover)] hover:text-foreground',
          )}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
