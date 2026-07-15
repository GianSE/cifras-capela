import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina classes condicionais (clsx) e resolve conflitos do Tailwind
 * (tailwind-merge). Utilitário padrão do shadcn/ui.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
