import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-24 w-full rounded-xl border border-input bg-[var(--color-surface-container-lowest)] px-4 py-3 text-sm text-foreground transition-colors',
        'placeholder:text-[var(--color-text-muted)]',
        'hover:border-[var(--color-outline)]',
        'focus-visible:border-gold-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
