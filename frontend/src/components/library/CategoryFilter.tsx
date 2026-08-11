import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  options: readonly string[];
  /** Categoria ativa (seleção única) ou null para "todas". */
  active: string | null;
  onChange: (value: string | null) => void;
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
  onDark,
  className,
}: CategoryFilterProps) {
  if (options.length === 0) return null;

  const chip = (label: string, value: string | null) => {
    const selected = active === value;
    return (
      <button
        key={value ?? '__all__'}
        type="button"
        onClick={() => onChange(value)}
        aria-pressed={selected}
        className={cn(
          'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
          selected
            ? 'bg-[image:var(--gradient-gold)] text-navy-900 shadow-gilded'
            : onDark
              ? 'border border-white/20 text-navy-100 hover:border-gold-400/50 hover:text-ivory'
              : 'border border-[var(--color-outline)] text-muted-foreground hover:border-gold-500 hover:text-foreground',
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="Filtrar por categoria"
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {chip('Todas', null)}
      {options.map((option) => chip(option, option))}
    </div>
  );
}
