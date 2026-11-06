import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarDays, Check, Download, ExternalLink, Library, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MissaSuggestions } from '@/hooks/useMissaSuggestions';
import { normalizeTitle } from '@/lib/library/duplicates';
import {
  dayPageUrl,
  parseDaysFromSitemap,
  searchDays,
  type LiturgicalDay,
  type SuggestionGroup,
} from '@/lib/missa-suggestions';
import { playlistStorage } from '@/lib/storage/playlists';
import type { SongIndexEntry } from '@/types/library';
import type { Playlist, PlaylistSection } from '@/types/playlist';

/**
 * O dia litúrgico da missa, no topo: de onde vêm as sugestões. Dá para trocar,
 * porque a data nem sempre decide sozinha (sábado à tarde, solenidade transferida).
 */
export function MissaDayBanner({ suggestions }: { suggestions: MissaSuggestions }) {
  const { status, day, options, chooseDay } = suggestions;
  const [changing, setChanging] = useState(false);

  if (status === 'unavailable' && !day) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy-700 text-gold-300">
        <CalendarDays className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        {day ? (
          <>
            <p className="text-xs text-muted-foreground">Sugestões para</p>
            <a
              href={dayPageUrl(day.slug)}
              target="_blank"
              rel="noreferrer"
              className="font-display inline-flex max-w-full items-center gap-1.5 text-base leading-snug text-foreground hover:underline"
            >
              <span>{day.title}</span>
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
          </>
        ) : status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Procurando as sugestões do dia…</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Essa data não está no calendário do site. Escolha o dia para ver as sugestões.
          </p>
        )}
      </div>
      {status !== 'loading' && (
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setChanging(true)}>
          {day ? 'Trocar' : 'Escolher dia'}
        </Button>
      )}

      <DayPicker
        open={changing}
        onOpenChange={setChanging}
        current={day}
        options={options}
        onChoose={(next) => {
          chooseDay(next);
          setChanging(false);
        }}
      />
    </div>
  );
}

function DayPicker({
  open,
  onOpenChange,
  current,
  options,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current?: LiturgicalDay;
  options: readonly LiturgicalDay[];
  onChoose: (day: LiturgicalDay) => void;
}) {
  const [query, setQuery] = useState('');
  const [days, setDays] = useState<readonly LiturgicalDay[] | null>(null);

  // Os nomes vêm do sitemap, o mesmo da busca de cifras: só baixa se abrir aqui.
  useEffect(() => {
    if (!open || days) return;
    let active = true;
    fetch('/api/catalog/musicas-para-missa', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.text() : ''))
      .then((xml) => {
        if (active) setDays(parseDaysFromSitemap(xml));
      })
      .catch(() => {
        if (active) setDays([]);
      });
    return () => {
      active = false;
    };
  }, [open, days]);

  const found = useMemo(() => searchDays(days ?? [], query), [days, query]);

  const row = (day: LiturgicalDay) => (
    <li key={day.slug}>
      <button
        type="button"
        onClick={() => onChoose(day)}
        aria-pressed={current?.slug === day.slug}
        className="flex w-full items-center gap-2 rounded-xl p-2.5 text-left text-sm text-foreground transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        <span className="min-w-0 flex-1">{day.title}</span>
        {current?.slug === day.slug && <Check className="size-4 shrink-0 text-accent" />}
      </button>
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dia litúrgico da missa</DialogTitle>
          <DialogDescription>A missa de sábado à tarde costuma ser a do domingo.</DialogDescription>
        </DialogHeader>

        {options.length > 0 && <ul>{options.map(row)}</ul>}

        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar outro dia, ex.: 32 domingo tempo comum"
          aria-label="Procurar outro dia"
        />
        {query.trim() !== '' && (
          <ul className="max-h-64 overflow-y-auto">
            {found.length > 0 ? (
              found.map(row)
            ) : (
              <li className="py-4 text-center text-sm text-muted-foreground">
                {days ? 'Nenhum dia encontrado.' : 'Carregando…'}
              </li>
            )}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botão ao lado de "Escolher música": aparece quando a parte tem sugestões. */
export function SuggestionsButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      <Sparkles className="size-4 text-gold-600 dark:text-gold-400" />
      {count} {count === 1 ? 'sugestão' : 'sugestões'} do dia
    </Button>
  );
}

/**
 * As sugestões de uma parte. O que já está na biblioteca entra direto; o resto
 * passa pela revisão de sempre e depois volta para a missa, já nesta parte.
 */
export function SuggestionsDialog({
  playlist,
  section,
  group,
  day,
  songs,
  onClose,
}: {
  playlist: Playlist;
  section: PlaylistSection | null;
  group: SuggestionGroup | undefined;
  day?: LiturgicalDay;
  songs: readonly SongIndexEntry[];
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const byTitle = useMemo(() => {
    const map = new Map<string, SongIndexEntry>();
    for (const song of songs) map.set(normalizeTitle(song.title), song);
    return map;
  }, [songs]);

  const bring = (url: string) => {
    if (!section) return;
    const params = new URLSearchParams({ url, missa: playlist.id, parte: section.id });
    navigate(`/importar?${params}`);
  };

  return (
    <Dialog open={section !== null && group !== undefined} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sugestões para {section?.name}</DialogTitle>
          {/* O salmo muda a cada dia, e o título diz qual é. As outras partes não. */}
          <DialogDescription>
            {group?.heading.includes(':') ? group.heading : day?.title}
          </DialogDescription>
        </DialogHeader>

        <ul className="-mx-1 flex max-h-96 flex-col divide-y divide-border overflow-y-auto px-1">
          {group?.songs.map((suggested) => {
            const existing = byTitle.get(normalizeTitle(suggested.title));
            const inMissa = existing && playlist.songIds.includes(existing.id);
            return (
              <li key={suggested.url} className="flex items-center gap-2 py-2">
                <a
                  href={suggested.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 text-sm font-medium text-foreground hover:underline"
                >
                  {suggested.title}
                  {existing && (
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      Na biblioteca: {existing.title}
                      {existing.artist && ` · ${existing.artist}`}
                    </span>
                  )}
                </a>
                {inMissa ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
                    <Check className="size-3.5" /> Na missa
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    {existing && section && (
                      <Button
                        size="sm"
                        variant="gold"
                        className="gap-1.5"
                        onClick={() => {
                          playlistStorage.addSong(playlist.id, existing.id, section.id);
                          onClose();
                        }}
                      >
                        <Library className="size-4" /> Usar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => bring(suggested.url)}
                    >
                      <Download className="size-4" /> Trazer
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {group?.moreUrl && (
          <a
            href={group.moreUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Mais opções no site <ExternalLink className="size-3" />
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
