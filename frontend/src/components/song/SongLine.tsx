import type { Line, Segment } from '@/types/song';
import { ChordBadge } from './ChordBadge';

interface SongLineProps {
  line: Line;
}

/**
 * Só há palavra nova quando há um espaço de verdade entre os dois trechos de
 * letra — texto vazio (acorde sem sílaba) não separa nada.
 */
export function sameWord(prevLyric: string, nextLyric: string): boolean {
  if (/\s$/.test(prevLyric)) return false;
  if (/^\s/.test(nextLyric)) return false;
  return true;
}

/**
 * Um segmento guarda tudo até o próximo acorde, que pode ser mais de uma
 * palavra (`[Am]Porque Ele`). Parte a letra dele em uma sub-parte por
 * palavra — o acorde fica só na primeira — para cada palavra poder quebrar
 * linha por conta própria, sem arrastar a seguinte.
 */
function splitIntoParts(segment: Segment): Segment[] {
  if (segment.lyric === '') return [segment];
  const tokens = segment.lyric.match(/\s*\S+\s*|\s+/g) ?? [segment.lyric];
  return tokens.map((lyric, i) => ({
    lyric,
    ...(i === 0 && segment.chord && { chord: segment.chord }),
  }));
}

/**
 * Agrupa os segmentos da linha em palavras, que não quebram por dentro.
 *
 * Um acorde no meio da palavra (`bu[C]sco`) parte a letra em dois segmentos —
 * um por acorde. Sem este agrupamento cada segmento quebra linha por conta
 * própria, e a palavra se espalha ("bu" numa linha, "sco" na próxima).
 */
export function groupIntoWords(segments: readonly Segment[]): Segment[][] {
  const parts = segments.flatMap(splitIntoParts);
  const words: Segment[][] = [];
  for (const part of parts) {
    const current = words.at(-1);
    const previous = current?.at(-1);
    if (current && previous && sameWord(previous.lyric, part.lyric)) {
      current.push(part);
    } else {
      words.push([part]);
    }
  }
  return words;
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
      {groupIntoWords(line.segments).map((word, wordIndex) => (
        <div key={wordIndex} className="song-word">
          {word.map((segment, index) => (
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
                {segment.lyric || ' '}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
