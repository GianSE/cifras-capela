import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Song } from '@/types/song';
import { transposeSong, getCapo, getKeyFromSemitones } from '@/lib/transpose/transpose';
import { preferencesStorage } from '@/lib/storage/preferences';
import { usePreferences } from './usePreferences';

/** Limite de transposição (±11 semitons; ±12 = oitava = mesmo acorde). */
const MAX_SEMITONES = 11;

export interface UseTransposeResult {
  /** AST da música já transposta. */
  readonly transposedSong: Song | null;
  /** Semitons aplicados (−11..+11). */
  readonly semitones: number;
  /** Casa do capotraste sugerida (0–11). */
  readonly capo: number;
  /** Tonalidade original. */
  readonly originalKey?: string;
  /** Tonalidade exibida (após transposição). */
  readonly currentKey?: string;
  /** Sobe um semitom. */
  readonly transposeUp: () => void;
  /** Desce um semitom. */
  readonly transposeDown: () => void;
  /** Define diretamente a quantidade de semitons. */
  readonly setSemitones: (value: number) => void;
  /** Volta à tonalidade original. */
  readonly reset: () => void;
  /** Preferência atual por bemóis. */
  readonly preferFlats: boolean;
  /** Alterna entre sustenidos e bemóis (persistido globalmente). */
  readonly toggleAccidentalPreference: () => void;
}

/**
 * Gerencia o estado de transposição de uma música.
 *
 * A preferência sustenidos/bemóis é **global e persistida** (localStorage);
 * a quantidade de semitons é local à sessão de leitura e reinicia ao abrir
 * outra música.
 */
export function useTranspose(song: Song | null): UseTransposeResult {
  const { preferFlats } = usePreferences();
  const [semitones, setSemitonesState] = useState(0);

  // Reinicia a transposição ao carregar uma nova música.
  useEffect(() => {
    setSemitonesState(0);
  }, [song]);

  const setSemitones = useCallback((value: number) => {
    const clamped = Math.max(-MAX_SEMITONES, Math.min(MAX_SEMITONES, value));
    setSemitonesState(clamped);
  }, []);

  const transposedSong = useMemo(() => {
    if (!song) return null;
    if (semitones === 0 && !preferFlats) return song;
    return transposeSong(song, semitones, preferFlats);
  }, [song, semitones, preferFlats]);

  const originalKey = song?.metadata.key;
  const currentKey = useMemo(
    () => (originalKey ? getKeyFromSemitones(originalKey, semitones, preferFlats) : undefined),
    [originalKey, semitones, preferFlats],
  );

  const capo = useMemo(
    () => (originalKey && currentKey ? getCapo(originalKey, currentKey) : 0),
    [originalKey, currentKey],
  );

  const transposeUp = useCallback(() => {
    setSemitonesState((prev) => Math.min(MAX_SEMITONES, prev + 1));
  }, []);

  const transposeDown = useCallback(() => {
    setSemitonesState((prev) => Math.max(-MAX_SEMITONES, prev - 1));
  }, []);

  const reset = useCallback(() => setSemitonesState(0), []);

  const toggleAccidentalPreference = useCallback(() => {
    preferencesStorage.update({ preferFlats: !preferencesStorage.getSnapshot().preferFlats });
  }, []);

  return {
    transposedSong,
    semitones,
    capo,
    originalKey,
    currentKey,
    transposeUp,
    transposeDown,
    setSemitones,
    reset,
    preferFlats,
    toggleAccidentalPreference,
  };
}
