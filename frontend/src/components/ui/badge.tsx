import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'bg-primary/12 text-primary',
        /** Tom da música e afins: dourado em fundo dourado translúcido. */
        accent:
          'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent font-mono tracking-wide',
        outline: 'border border-[var(--color-outline)] text-foreground',
        muted: 'bg-muted text-muted-foreground',
        /** Rótulo cerimonial: caixa alta espaçada, sem preenchimento. */
        eyebrow: 'eyebrow px-0 py-0',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
