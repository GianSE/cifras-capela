import { Guitar } from 'lucide-react';

interface CapoControlProps {
  originalKey?: string;
  displayedKey?: string;
  capo: number;
}

/**
 * Painel informativo do capotraste: tom original, tom exibido e a casa
 * sugerida para tocar com os desenhos do tom original.
 */
export function CapoControl({ originalKey, displayedKey, capo }: CapoControlProps) {
  return (
    <div className="rounded-xl border border-border bg-[var(--color-surface-container-low)] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Guitar className="size-4 text-primary" /> Capotraste
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Original</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-foreground">
            {originalKey ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Exibido</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-accent">
            {displayedKey ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Capo</dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-primary">
            {capo > 0 ? `${capo}ª` : '—'}
          </dd>
        </div>
      </dl>
      {capo > 0 && originalKey && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Coloque o capo na <strong className="text-foreground">{capo}ª casa</strong> e toque com os
          desenhos de <strong className="text-foreground">{originalKey}</strong>.
        </p>
      )}
    </div>
  );
}
