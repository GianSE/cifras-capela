import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ShieldAlert, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { useSongLibrary } from '@/hooks/useSongLibrary';
import { usePagedList } from '@/hooks/usePagedList';
import { songService } from '@/services/song-service';
import {
  groupByExactTitle,
  groupBySimilarLyrics,
  findPossibleSpanish,
  LARGE_GROUP_THRESHOLD,
  type AuditGroup,
  type SpanishFlag,
} from '@/lib/library/audit';
import type { SongIndexEntry } from '@/types/library';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/library/EmptyState';
import { InfiniteScrollSentinel } from '@/components/library/InfiniteScrollSentinel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const IGNORED_GROUPS_KEY = 'cifras-capela:audit-ignored-groups';
const IGNORED_SPANISH_KEY = 'cifras-capela:audit-ignored-spanish';

function readIgnored(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function addIgnored(key: string, id: string): void {
  const set = readIgnored(key);
  set.add(id);
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* sem espaço no localStorage: só não persiste o "ignorar" entre sessões */
  }
}

function songMeta(song: SongIndexEntry): string {
  return [song.artist, song.key, ...(song.categories ?? [])].filter(Boolean).join(' · ');
}

/** Um card de grupo (título igual ou letra parecida): escolhe quem fica, apaga o resto. */
function GroupCard({
  group,
  onResolved,
  onIgnore,
}: {
  group: AuditGroup;
  onResolved: (deletedIds: readonly string[]) => void;
  onIgnore: () => void;
}) {
  const [kept, setKept] = useState<ReadonlySet<string>>(() => {
    if (group.suggestedKeepIndex === -1) return new Set(group.songs.map((s) => s.id));
    return new Set([group.songs[group.suggestedKeepIndex]!.id]);
  });
  const [working, setWorking] = useState(false);

  const toggle = (id: string) =>
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toDelete = group.songs.filter((s) => !kept.has(s.id));

  const apply = async () => {
    if (toDelete.length === 0) return;
    if (kept.size === 0 && !confirm(`Isso vai apagar as ${group.songs.length} versões. Continuar?`)) {
      return;
    }
    setWorking(true);
    try {
      await Promise.all(toDelete.map((s) => songService.deleteSong(s.id)));
      onResolved(toDelete.map((s) => s.id));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-display text-base text-foreground">
          {group.songs.length} versões
          {group.suggestedKeepIndex === -1 && (
            <span className="ml-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              grupo grande — revise com atenção
            </span>
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={onIgnore} disabled={working}>
          Ignorar
        </Button>
      </div>

      <ul className="flex flex-col gap-1.5">
        {group.songs.map((song) => (
          <li
            key={song.id}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-hover)]"
          >
            <input
              type="checkbox"
              checked={kept.has(song.id)}
              onChange={() => toggle(song.id)}
              aria-label={`Manter "${song.title}"`}
              className="size-4 shrink-0 accent-gold-500"
            />
            <Link
              to={`/musica/${song.id}`}
              target="_blank"
              className="min-w-0 flex-1 truncate text-sm text-foreground hover:underline"
            >
              {song.title}
            </Link>
            <span className="shrink-0 truncate text-xs text-muted-foreground">
              {songMeta(song)}
            </span>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="destructive"
          disabled={toDelete.length === 0 || working}
          onClick={() => void apply()}
          className="gap-1.5"
        >
          {working ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Apagar {toDelete.length > 0 ? `${toDelete.length} ` : ''}e manter o resto
        </Button>
      </div>
    </div>
  );
}

function GroupList({
  groups,
  onChange,
  emptyLabel,
}: {
  groups: readonly AuditGroup[];
  onChange: (next: readonly AuditGroup[]) => void;
  emptyLabel: string;
}) {
  const { visible, hasMore, loadMore } = usePagedList(groups);

  if (groups.length === 0) {
    return <EmptyState icon={ShieldAlert} title={emptyLabel} description="" />;
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visible.map((group) => (
          <li key={group.key}>
            <GroupCard
              group={group}
              onResolved={(deletedIds) => {
                const remaining = group.songs.filter((s) => !deletedIds.includes(s.id));
                const nextGroup = { ...group, songs: remaining };
                onChange(
                  remaining.length > 1
                    ? groups.map((g) => (g.key === group.key ? nextGroup : g))
                    : groups.filter((g) => g.key !== group.key),
                );
              }}
              onIgnore={() => {
                addIgnored(IGNORED_GROUPS_KEY, group.key);
                onChange(groups.filter((g) => g.key !== group.key));
              }}
            />
          </li>
        ))}
      </ul>
      {hasMore && <InfiniteScrollSentinel onVisible={loadMore} />}
    </>
  );
}

function SpanishList({
  flags,
  onChange,
}: {
  flags: readonly SpanishFlag[];
  onChange: (next: readonly SpanishFlag[]) => void;
}) {
  const { visible, hasMore, loadMore } = usePagedList(flags);
  const [workingId, setWorkingId] = useState<string | null>(null);

  if (flags.length === 0) {
    return <EmptyState icon={ShieldAlert} title="Nada suspeito de espanhol" description="" />;
  }

  const remove = async (id: string) => {
    setWorkingId(id);
    try {
      await songService.deleteSong(id);
      onChange(flags.filter((f) => f.song.id !== id));
    } finally {
      setWorkingId(null);
    }
  };

  const ignore = (id: string) => {
    addIgnored(IGNORED_SPANISH_KEY, id);
    onChange(flags.filter((f) => f.song.id !== id));
  };

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {visible.map(({ song, score }) => (
          <li
            key={song.id}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2"
          >
            <Link
              to={`/musica/${song.id}`}
              target="_blank"
              className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
            >
              {song.title}
            </Link>
            <span className="shrink-0 truncate text-xs text-muted-foreground">
              {songMeta(song)}
            </span>
            <span
              className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
              title="Indício de espanhol — quanto maior, mais forte"
            >
              {score}
            </span>
            <Button variant="ghost" size="sm" onClick={() => ignore(song.id)}>
              Não é
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={workingId === song.id}
              onClick={() => void remove(song.id)}
              className="gap-1.5"
            >
              {workingId === song.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Apagar
            </Button>
          </li>
        ))}
      </ul>
      {hasMore && <InfiniteScrollSentinel onVisible={loadMore} />}
    </>
  );
}

export function AuditPage() {
  const { songs, isLoading } = useSongLibrary();
  const [analyzed, setAnalyzed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [exactGroups, setExactGroups] = useState<readonly AuditGroup[]>([]);
  const [similarGroups, setSimilarGroups] = useState<readonly AuditGroup[]>([]);
  const [spanishFlags, setSpanishFlags] = useState<readonly SpanishFlag[]>([]);

  const analyze = () => {
    setAnalyzing(true);
    // Dá um instante para o spinner pintar antes da varredura (pesada) travar a thread.
    setTimeout(() => {
      const ignoredGroups = readIgnored(IGNORED_GROUPS_KEY);
      const ignoredSpanish = readIgnored(IGNORED_SPANISH_KEY);

      setExactGroups(groupByExactTitle(songs).filter((g) => !ignoredGroups.has(g.key)));
      setSimilarGroups(groupBySimilarLyrics(songs).filter((g) => !ignoredGroups.has(g.key)));
      setSpanishFlags(findPossibleSpanish(songs).filter((f) => !ignoredSpanish.has(f.song.id)));

      setAnalyzing(false);
      setAnalyzed(true);
    }, 30);
  };

  const counts = useMemo(
    () => ({
      exact: exactGroups.length,
      similar: similarGroups.length,
      spanish: spanishFlags.length,
    }),
    [exactGroups, similarGroups, spanishFlags],
  );

  return (
    <>
      <PageHeader
        title="Auditoria da biblioteca"
        icon={ShieldAlert}
        subtitle={`${songs.length} músicas no acervo`}
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
        {!analyzed ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Procura músicas com título repetido, letra muito parecida (mesmo com nome
              diferente) e possíveis músicas em espanhol — para você revisar e limpar a
              biblioteca. Não apaga nada por conta própria.
            </p>
            <Button
              onClick={analyze}
              disabled={isLoading || analyzing}
              size="lg"
              variant="gold"
              className="gap-2"
            >
              {analyzing && <Loader2 className="size-4 animate-spin" />}
              Analisar biblioteca
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="exact">
            <TabsList>
              <TabsTrigger value="exact">Título igual ({counts.exact})</TabsTrigger>
              <TabsTrigger value="similar">Letra parecida ({counts.similar})</TabsTrigger>
              <TabsTrigger value="spanish">Possível espanhol ({counts.spanish})</TabsTrigger>
            </TabsList>

            <TabsContent value="exact" className="mt-4">
              <GroupList
                groups={exactGroups}
                onChange={setExactGroups}
                emptyLabel="Nenhum título repetido"
              />
            </TabsContent>
            <TabsContent value="similar" className="mt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Letras com {'>'}60% de trechos em comum (desconsiderando textos litúrgicos
                curtos). Grupos com mais de {LARGE_GROUP_THRESHOLD} músicas não têm sugestão
                automática — revise antes de apagar.
              </p>
              <GroupList
                groups={similarGroups}
                onChange={setSimilarGroups}
                emptyLabel="Nenhuma letra parecida encontrada"
              />
            </TabsContent>
            <TabsContent value="spanish" className="mt-4">
              <SpanishList flags={spanishFlags} onChange={setSpanishFlags} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
