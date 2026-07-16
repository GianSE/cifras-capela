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
  /** Preferência atual por bemóis. */
  readonly preferFlats: boolean;
  /** Alterna entre sustenidos e bemóis (persistido globalmente). */
  readonly toggleAccidentalPreference: () => void;
}

/**
 * Gerencia o estado de transposição de uma música.
 *
 * A preferência sustenidos/bemóis é **global e persistida** (localStorage).
 * Os semitons são salvos **por música**: ao reabrir a cifra, ela volta no tom
 * em que você parou. Sem `songId`, a transposição é apenas da sessão.
 *
 * @param song - AST da música (a original, não a transposta).
 * @param songId - ID da música; habilita salvar/restaurar o tom.
 */
export function useTranspose(song: Song | null, songId?: string): UseTransposeResult {
  const { preferFlats } = usePreferences();
  const [semitones, setSemitonesState] = useState(0);

  // Restaura o tom salvo ao abrir a música (0 se nunca foi transposta).
  useEffect(() => {
    setSemitonesState(songId ? preferencesStorage.getTransposition(songId) : 0);
  }, [song, songId]);

  /** Aplica o limite e persiste o tom da música. */
  const setSemitones = useCallback(
    (value: number) => {
      const clamped = Math.max(-MAX_SEMITONES, Math.min(MAX_SEMITONES, value));
      setSemitonesState(clamped);
      if (songId) preferencesStorage.setTransposition(songId, clamped);
    },
    [songId],
  );

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

  const transposeUp = useCallback(() => setSemitones(semitones + 1), [setSemitones, semitones]);
  const transposeDown = useCallback(() => setSemitones(semitones - 1), [setSemitones, semitones]);

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
    preferFlats,
    toggleAccidentalPreference,
  };
}
