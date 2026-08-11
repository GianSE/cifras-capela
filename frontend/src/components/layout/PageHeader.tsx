import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  /** Segunda linha, menor — contagem, dica curta. Cabe uma linha só. */
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Botões à direita do título, dentro da barra. */
  actions?: ReactNode;
  /** Vai logo abaixo da barra, já sobre o marfim: busca, filtros, abas. */
  children?: ReactNode;
  /**
   * Largura da coluna, para a barra alinhar com o conteúdo da página — cada
   * tela usa a sua (a de configurações é mais estreita que a da biblioteca).
   */
  contentWidth?: string;
  className?: string;
}

/**
 * Barra de topo azul das telas do app.
 *
 * Fina de propósito — do mesmo tamanho da barra do leitor de cifra, que é a
 * tela onde o app passa a maior parte do tempo. Assim a moldura é a mesma em
 * todo lugar e sobra tela para o conteúdo, que é o que importa.
 *
 * Por isso `children` (busca, filtros) é renderizado **fora** da faixa azul:
 * dentro dela, a barra voltaria a crescer.
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  contentWidth = 'max-w-4xl',
  className,
}: PageHeaderProps) {
  return (
    <>
      {/* `shrink-0` porque a barra é filha de um flex-column (`<main>`) e,
          sem ele, encolheria quando o conteúdo fosse mais alto que a tela. */}
      <header className={cn('hero-blue safe-top shrink-0', className)}>
        {/* Mesmo contêiner do conteúdo: título, busca e lista alinham na
            mesma coluna, em vez de a barra correr solta até a borda. */}
        <div
          className={cn('mx-auto flex h-16 w-full items-center gap-3 px-4 md:px-8', contentWidth)}
        >
          {Icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold-400/30 text-gold-300">
              <Icon className="size-[18px]" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-xl leading-tight text-ivory md:text-2xl">
              {title}
            </h1>
            {subtitle && <p className="truncate text-xs text-navy-200">{subtitle}</p>}
          </div>

          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>

      {children && (
        <div className={cn('mx-auto w-full shrink-0 px-4 pt-5 md:px-8', contentWidth)}>
          {children}
        </div>
      )}
    </>
  );
}
