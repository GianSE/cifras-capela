import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { filterChipClass } from './filter-chip';

interface CategoryFilterProps {
  options: readonly string[];
  /** Categoria ativa (seleção única) ou null para "todas". */
  active: string | null;
  onChange: (value: string | null) => void;
  /**
   * Pastilha extra antes de "Todas" (ex.: favoritas). Fica dentro da mesma
   * faixa rolável, senão viraria uma segunda linha de filtros na horizontal.
   */
  leading?: ReactNode;
  /** Sobre a faixa azul do cabeçalho: inverte as cores das pastilhas. */
  onDark?: boolean;
  className?: string;
}

/**
 * Filtro de categoria em pastilhas roláveis (seleção única). A ativa recebe o
 * dourado; as demais ficam discretas, para a lista de músicas continuar sendo
 * o assunto principal da tela.
 */
export function CategoryFilter({
  options,
  active,
  onChange,
  leading,
  onDark,
  className,
}: CategoryFilterProps) {
  if (options.length === 0 && !leading) return null;

  const chip = (label: string, value: string | null) => (
    <button
      key={value ?? '__all__'}
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={active === value}
      className={filterChipClass(active === value, onDark)}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Filtros da biblioteca"
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {leading}
      {options.length > 0 && chip('Todas', null)}
      {options.map((option) => chip(option, option))}
    </div>
  );
}
