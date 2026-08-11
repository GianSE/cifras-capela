import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Estado vazio reutilizável (sem resultados, sem favoritos, etc.). */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--color-outline)] bg-[var(--color-surface-container-low)] px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-gold-400/40 bg-[image:var(--gradient-blue)] text-gold-300">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="font-display text-xl text-foreground">{title}</p>
        {description && (
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
