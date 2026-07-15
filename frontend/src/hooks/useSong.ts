import { useState, useEffect } from 'react';
import type { Song, ParseError } from '@/types/song';
import { parse } from '@/lib/parser/index';

interface UseSongResult {
  song: Song | null;
  errors: readonly ParseError[];
  isLoading: boolean;
  parseSong: (chordproText: string) => void;
}

/**
 * Hook to parse and manage a ChordPro song.
 */
export function useSong(initialText?: string): UseSongResult {
  const [song, setSong] = useState<Song | null>(null);
  const [errors, setErrors] = useState<readonly ParseError[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const parseSong = (chordproText: string) => {
    setIsLoading(true);
    try {
      const result = parse(chordproText);
      setSong(result.song);
      setErrors(result.errors);
    } catch (e) {
      console.error('Error parsing song:', e);
      setErrors([
        {
          line: 0,
          message: 'Erro fatal ao processar a música.',
          severity: 'error',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialText) {
      parseSong(initialText);
    }
  }, [initialText]);

  return { song, errors, isLoading, parseSong };
}
