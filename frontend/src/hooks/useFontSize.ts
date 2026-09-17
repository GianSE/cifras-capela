import { useCallback } from 'react';
import { preferencesStorage } from '@/lib/storage/preferences';
import { usePreferences } from './usePreferences';

const STEP = 2;

/**
 * Leitor e modo apresentação guardam tamanhos separados: no palco a letra
 * costuma ir maior, mas às vezes precisa caber inteira na tela.
 */
const PROFILES = {
  reader: { key: 'fontSize', min: 12, max: 40, initial: 18 },
  stage: { key: 'stageFontSize', min: 10, max: 56, initial: 24 },
} as const;

export type FontSizeProfile = keyof typeof PROFILES;

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
export function useFontSize(profile: FontSizeProfile = 'reader'): UseFontSizeResult {
  const { key, min, max, initial } = PROFILES[profile];
  const fontSize = usePreferences()[key];

  const set = useCallback(
    (value: number) => {
      preferencesStorage.update({ [key]: Math.max(min, Math.min(max, value)) });
    },
    [key, min, max],
  );

  const increase = useCallback(() => {
    set(preferencesStorage.getSnapshot()[key] + STEP);
  }, [set, key]);

  const decrease = useCallback(() => {
    set(preferencesStorage.getSnapshot()[key] - STEP);
  }, [set, key]);

  const reset = useCallback(() => set(initial), [set, initial]);

  return {
    fontSize,
    increase,
    decrease,
    reset,
    set,
    canIncrease: fontSize < max,
    canDecrease: fontSize > min,
  };
}
