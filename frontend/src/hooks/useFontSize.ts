import { useCallback } from 'react';
import { preferencesStorage } from '@/lib/storage/preferences';
import { usePreferences } from './usePreferences';

const MIN_FONT = 12;
const MAX_FONT = 40;
const STEP = 2;

export interface UseFontSizeResult {
  readonly fontSize: number;
  readonly increase: () => void;
  readonly decrease: () => void;
  readonly reset: () => void;
  readonly set: (value: number) => void;
  readonly canIncrease: boolean;
  readonly canDecrease: boolean;
}

/**
 * Controla o tamanho da fonte da letra (persistido globalmente).
 * Usado pelos botões A− / A+ do leitor e do modo apresentação.
 */
export function useFontSize(): UseFontSizeResult {
  const { fontSize } = usePreferences();

  const set = useCallback((value: number) => {
    preferencesStorage.update({ fontSize: Math.max(MIN_FONT, Math.min(MAX_FONT, value)) });
  }, []);

  const increase = useCallback(() => {
    set(preferencesStorage.getSnapshot().fontSize + STEP);
  }, [set]);

  const decrease = useCallback(() => {
    set(preferencesStorage.getSnapshot().fontSize - STEP);
  }, [set]);

  const reset = useCallback(() => set(18), [set]);

  return {
    fontSize,
    increase,
    decrease,
    reset,
    set,
    canIncrease: fontSize < MAX_FONT,
    canDecrease: fontSize > MIN_FONT,
  };
}
