import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Rótulo curto em caixa alta dourada, acima do título. */
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Botões à direita do título. */
  actions?: ReactNode;
  /** Vai colado ao pé da faixa — busca, filtros, abas. */
  children?: ReactNode;
  className?: string;
}

/**
 * Faixa azul do manto que abre cada tela — o `PageHero` do site da Capela
 * trazido para o app: gradiente azul, título serifado, fio dourado no pé
 * (aplicado pela classe `.hero-blue`) e um brilho quente no canto.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className,
}: PageHeaderProps) {
  // Duas classes que precisam andar juntas:
  //  - `overflow-hidden` recorta o brilho decorativo, posicionado para fora da
  //    faixa — sem ele, a página inteira ganhava rolagem horizontal;
  //  - `shrink-0` porque a faixa é filha de um flex-column (`<main>`), e num
  //    flex item o `overflow-hidden` zera o `min-height: auto`, o que fazia o
  //    cabeçalho encolher até desaparecer.
  return (
    <header
      className={cn('hero-blue safe-top relative isolate shrink-0 overflow-hidden', className)}
    >
      {/* Raio dourado difuso — dá profundidade sem pesar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 -z-10 size-64 rounded-full bg-gold-400/20 blur-3xl"
      />

      <div className="mx-auto w-full max-w-4xl px-4 pb-6 pt-6 md:px-8 md:pb-7 md:pt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full border border-gold-400/35 bg-white/8 text-gold-300">
                <Icon className="size-5" />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && <p className="eyebrow mb-1 text-gold-400">{eyebrow}</p>}
              <h1 className="font-display truncate text-3xl text-ivory md:text-4xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-navy-100/80 md:text-base">{subtitle}</p>}
            </div>
          </div>

          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>

        {children && <div className="mt-5">{children}</div>}
      </div>
    </header>
  );
}
