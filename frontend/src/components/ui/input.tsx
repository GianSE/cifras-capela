import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-xl border border-input bg-[var(--color-surface-container-lowest)] px-4 py-2 text-sm text-foreground transition-colors',
          'placeholder:text-[var(--color-text-muted)]',
          'hover:border-[var(--color-outline)]',
          'focus-visible:border-gold-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
