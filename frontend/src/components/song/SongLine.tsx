import type { Line } from '@/types/song';
import { ChordBadge } from './ChordBadge';

interface SongLineProps {
  line: Line;
}

/**
 * Uma linha da cifra: uma fileira de colunas, cada uma com o acorde em cima e
 * a sílaba embaixo.
 *
 * As duas linhas (acorde e letra) são **sempre** renderizadas, mesmo vazias.
 * Sem isso, um acorde solto no fim da frase (`...meu Je[Am]sus [D7]`) formaria
 * uma coluna só de acorde e, por causa do `align-items: flex-end`, cairia na
 * altura da letra em vez de ficar acima dela.
 */
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
      {line.segments.map((segment, index) => (
        <div key={index} className="song-segment">
          <div className="song-segment-chord flex items-end pb-[2px]">
            {segment.chord ? (
              <ChordBadge chord={segment.chord} />
            ) : (
              <span className="select-none opacity-0" aria-hidden="true">
                _
              </span>
            )}
          </div>

          <div className="song-segment-lyric font-lyrics font-medium">
            {segment.lyric || ' '}
          </div>
        </div>
      ))}
    </div>
  );
}
