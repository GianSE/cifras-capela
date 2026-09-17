import { useState } from 'react';
import { Check, ExternalLink, Loader2, Pause, Play, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchYoutube, type YoutubeResult } from '@/lib/youtube-search';
import { youtubeEmbedUrl, youtubeSearchUrl } from '@/lib/youtube';

interface VideoSearchProps {
  /** Termo inicial — o título e o artista da música. */
  initialQuery: string;
  /** Vídeo escolhido no momento (para marcar na lista). */
  selectedId?: string;
  onSelect: (result: YoutubeResult) => void;
  /** Avisa quando o Worker não tem a chave da API: a tela cai no modo manual. */
  onUnavailable?: () => void;
}

/**
 * Procura o vídeo da música sem sair do app.
 *
 * Cada resultado tem um play que toca ali mesmo — dá para conferir se é a
 * versão certa antes de escolher. Escolher só preenche o link; quem salva é a
 * tela que usa este componente.
 */
export function VideoSearch({
  initialQuery,
  selectedId,
  onSelect,
  onUnavailable,
}: VideoSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<YoutubeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Vídeo tocando na prévia (um por vez, senão viram duas músicas juntas). */
  const [playing, setPlaying] = useState<string | null>(null);

  const search = async () => {
    const term = query.trim();
    if (!term || loading) return;

    setLoading(true);
    setError(null);
    setPlaying(null);
    const response = await searchYoutube(term);
    setLoading(false);

    if (response.status === 'not-configured') {
      onUnavailable?.();
      return;
    }
    if (response.status === 'error') {
      setError(response.message);
      return;
    }
    setResults(response.results);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Nome da música e do artista"
          aria-label="Procurar vídeo no YouTube"
        />
        <Button
          onClick={() => void search()}
          disabled={loading || query.trim() === ''}
          className="shrink-0 gap-1.5"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Procurar
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {results?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nada encontrado. Tente outro termo ou{' '}
          <a
            href={youtubeSearchUrl(query)}
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            procure no YouTube
            <ExternalLink className="ml-1 inline size-3" />
          </a>
          .
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="-mx-1 flex max-h-80 flex-col gap-1.5 overflow-y-auto px-1">
          {results.map((result) => (
            <li key={result.id}>
              <ResultRow
                result={result}
                selected={selectedId === result.id}
                playing={playing === result.id}
                onTogglePlay={() => setPlaying((id) => (id === result.id ? null : result.id))}
                onSelect={() => onSelect(result)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultRow({
  result,
  selected,
  playing,
  onTogglePlay,
  onSelect,
}: {
  result: YoutubeResult;
  selected: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-colors',
        selected ? 'border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_10%,transparent)]' : 'border-transparent hover:border-border',
      )}
    >
      <div className="flex items-center gap-2.5 p-1.5">
        {/* A miniatura é o botão de ouvir: é o gesto óbvio sobre um vídeo. */}
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? `Parar ${result.title}` : `Ouvir ${result.title}`}
          aria-pressed={playing}
          className="group relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-navy-800 sm:w-28"
        >
          {result.thumbnail && (
            <img
              src={result.thumbnail}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          )}
          <span className="absolute inset-0 grid place-items-center bg-navy-950/35 transition-colors group-hover:bg-navy-950/15">
            <span className="grid size-7 place-items-center rounded-full bg-white/95 text-navy-900 shadow-soft">
              {playing ? (
                <Pause className="size-3.5 fill-current" />
              ) : (
                <Play className="size-3.5 translate-x-px fill-current" />
              )}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 py-1 text-left"
          aria-pressed={selected}
        >
          <span className="line-clamp-2 text-sm font-medium text-foreground">{result.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {result.channel}
          </span>
        </button>

        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full',
            selected ? 'bg-[image:var(--gradient-gold)] text-navy-900' : 'text-transparent',
          )}
          aria-hidden
        >
          <Check className="size-4" />
        </span>
      </div>

      {playing && (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={youtubeEmbedUrl(result.id)}
            title={result.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="size-full"
          />
        </div>
      )}
    </div>
  );
}
