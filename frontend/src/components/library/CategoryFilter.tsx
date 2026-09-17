import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown, Search, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { filterChipClass } from './filter-chip';

interface CategoryFilterProps {
  options: readonly string[];
  /** Categoria ativa (seleção única) ou null para "todas". */
  active: string | null;
  onChange: (value: string | null) => void;
  /** Pastilhas extras antes do menu de categorias (ex.: recentes, favoritas). */
  leading?: ReactNode;
  /** Sobre a faixa azul do cabeçalho: inverte as cores das pastilhas. */
  onDark?: boolean;
  className?: string;
}

/** Minúsculas e sem acentos: "hinos" acha "Hinos", "musica" acha "Música". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Filtro da biblioteca: as pastilhas de coleção (`leading`) e, ao lado, um
 * menu suspenso de categorias com busca — com muitas categorias, a faixa de
 * pastilhas virava uma rolagem horizontal difícil de achar o que se queria.
 */
export function CategoryFilter({
  options,
  active,
  onChange,
  leading,
  onDark,
  className,
}: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const needle = fold(term.trim());
    return needle ? options.filter((option) => fold(option).includes(needle)) : options;
  }, [options, term]);

  if (options.length === 0 && !leading) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setTerm('');
      // O Radix foca o próprio menu ao abrir; a busca pega o foco logo depois.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const select = (value: string | null) => {
    onChange(value);
    setOpen(false);
  };

  // Teclas digitadas são da busca, não do "typeahead" do menu. A seta para
  // baixo desce para a lista; Enter escolhe a primeira que sobrou.
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
      return;
    }
    if (e.key === 'Enter' && visible[0] !== undefined) {
      e.preventDefault();
      select(visible[0]);
      return;
    }
    e.stopPropagation();
  };

  // Passar o mouse não rouba o foco da busca (o Radix focaria o item).
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  const itemClass = 'hover:bg-[var(--color-surface-hover)]';

  return (
    <div
      role="group"
      aria-label="Filtros da biblioteca"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {leading}

      {options.length > 0 && (
        <DropdownMenu open={open} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={active ? `Categoria: ${active}` : 'Escolher categoria'}
              className={cn(filterChipClass(active !== null, onDark), 'max-w-full')}
            >
              <Tags className="size-4" />
              <span className="truncate">{active ?? 'Categorias'}</span>
              <ChevronDown
                className={cn('size-4 transition-transform', open && 'rotate-180')}
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-64 p-0">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar categoria..."
                aria-label="Buscar categoria"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                style={{ outline: 'none' }}
              />
            </div>

            <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
              {!term.trim() && (
                <>
                  <DropdownMenuItem
                    onSelect={() => select(null)}
                    onPointerMove={keepFocus}
                    onPointerLeave={keepFocus}
                    className={itemClass}
                  >
                    <Check className={cn('text-gold-600', active !== null && 'invisible')} />
                    Todas as categorias
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {visible.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onSelect={() => select(option)}
                  onPointerMove={keepFocus}
                  onPointerLeave={keepFocus}
                  className={cn(itemClass, 'capitalize')}
                >
                  <Check className={cn('text-gold-600', active !== option && 'invisible')} />
                  {option}
                </DropdownMenuItem>
              ))}

              {visible.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma categoria com “{term.trim()}”
                </p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
