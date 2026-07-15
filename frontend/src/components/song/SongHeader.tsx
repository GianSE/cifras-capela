import type { SongMetadata } from '@/types/song';
import { Music2, Gauge, Clock, Guitar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SongHeaderProps {
  metadata: SongMetadata;
  /** Tonalidade atualmente exibida (pode diferir da original se transposta). */
  displayedKey?: string;
  capo?: number;
}

/**
 * Cabeçalho da cifra: título, artista e chips de metadados
 * (tom exibido, BPM, compasso, capo).
 */
export function SongHeader({ metadata, displayedKey, capo }: SongHeaderProps) {
  const { title, artist, tempo, time, categories } = metadata;

  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {artist && <p className="mt-1 text-base font-medium text-muted-foreground">{artist}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {displayedKey && (
          <Badge variant="accent" className="gap-1 text-sm">
            <Music2 className="size-3.5" /> {displayedKey}
          </Badge>
        )}
        {tempo !== undefined && (
          <Badge variant="muted" className="gap-1">
            <Gauge className="size-3.5" /> {tempo} BPM
          </Badge>
        )}
        {time && (
          <Badge variant="muted" className="gap-1">
            <Clock className="size-3.5" /> {time}
          </Badge>
        )}
        {capo !== undefined && capo > 0 && (
          <Badge variant="primary" className="gap-1">
            <Guitar className="size-3.5" /> Capo {capo}
          </Badge>
        )}
        {categories?.map((c) => (
          <Badge key={c} variant="outline" className="capitalize">
            {c}
          </Badge>
        ))}
      </div>
    </header>
  );
}
