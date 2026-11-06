import { suggestMissaDates, formatMissaName } from '@/lib/missa';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface MissaDatePickerProps {
  /** Data escolhida, em `AAAA-MM-DD`. */
  value: string;
  onChange: (date: string) => void;
  onSubmit?: () => void;
}

/**
 * Escolha da data da missa: quase sempre é o próximo fim de semana, então
 * sábado e domingo ficam a um toque, e o campo aceita qualquer outra data.
 */
export function MissaDatePicker({ value, onChange, onSubmit }: MissaDatePickerProps) {
  const { saturday, sunday } = suggestMissaDates();

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Próximo fim de semana" className="grid grid-cols-2 gap-2">
        {[saturday, sunday].map((date) => (
          <button
            key={date}
            type="button"
            aria-pressed={value === date}
            onClick={() => onChange(date)}
            className={cn(
              'rounded-xl border p-3 text-left text-sm font-semibold text-foreground transition-colors',
              value === date
                ? 'border-gold-500 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                : 'border-border hover:border-gold-400/60',
            )}
          >
            {formatMissaName(date)}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="missa-date" className="text-xs text-muted-foreground">
          Outra data
        </Label>
        <Input
          id="missa-date"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
        />
      </div>
    </div>
  );
}
