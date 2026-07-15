import type { Line } from '@/types/song';
import { ChordBadge } from './ChordBadge';

interface SongLineProps {
  line: Line;
}

export function SongLine({ line }: SongLineProps) {
  if (line.type === 'empty') {
    return <div className="h-6" aria-hidden="true" />;
  }

  if (line.type === 'comment') {
    return (
      <div className="py-1 text-sm font-medium italic text-[var(--color-text-muted)]">
        {line.comment}
      </div>
    );
  }

  return (
    <div className="song-line">
      {line.segments.map((segment, index) => {
        // If the segment has no chord, it's just lyrics.
        // We use pre-wrap so trailing/leading spaces are preserved.
        return (
          <div key={index} className="song-segment">
            {/* Chord Area (fixed height to keep lines aligned even if some words have no chords) */}
            <div className="song-segment-chord flex items-end pb-[2px]">
              {segment.chord ? <ChordBadge chord={segment.chord} /> : <span className="opacity-0 select-none">_</span>}
            </div>
            {/* Lyric Area */}
            {segment.lyric && (
              <div className="song-segment-lyric text-[var(--color-text-primary)] font-lyrics font-medium">
                {segment.lyric}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
