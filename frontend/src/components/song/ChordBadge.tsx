import type { Chord } from '@/types/song';

interface ChordBadgeProps {
  chord: Chord;
  className?: string;
}

export function ChordBadge({ chord, className = '' }: ChordBadgeProps) {
  // Format the bass note if it exists (e.g. /G)
  const bassText = chord.bass
    ? `/${chord.bass.root}${chord.bass.accidental || ''}`
    : '';

  return (
    <span className={`chord-badge ${className}`}>
      {chord.root}
      {chord.accidental && (
        <span className="text-[0.85em]">{chord.accidental}</span>
      )}
      {chord.quality}
      {chord.extensions && (
        <sup className="text-[0.75em] leading-[0] ml-[1px]">
          {chord.extensions}
        </sup>
      )}
      {bassText && (
        <span className="opacity-90">{bassText}</span>
      )}
    </span>
  );
}
