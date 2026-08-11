import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  children: ReactNode;
  icon?: LucideIcon;
  /** Conteúdo à direita (contagem, botão…). */
  aside?: ReactNode;
  className?: string;
}

/**
 * Título de seção com o fio dourado que preenche o espaço até a borda —
 * o ornamento que o site usa para separar blocos sem pesar a página.
 */
export function SectionTitle({ children, icon: Icon, aside, className }: SectionTitleProps) {
  return (
    <div className={cn('mb-3 flex items-center gap-3', className)}>
      {Icon && <Icon className="size-4 shrink-0 text-gold-600 dark:text-gold-400" />}
      <h2 className="font-display shrink-0 text-lg text-foreground">{children}</h2>
      <span aria-hidden className="rule-gold min-w-4 flex-1" />
      {aside && <span className="shrink-0 text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}
