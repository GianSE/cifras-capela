import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download, ExternalLink, Library, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SOURCE_NAMES,
  loadCatalog,
  searchCatalog,
  searchCifraClub,
  type CatalogEntry,
  type CatalogSource,
  type CifraClubResult,
} from '@/lib/catalog';
import { normalizeText, normalizeTitle } from '@/lib/library/duplicates';
import type { PageHint } from '@/lib/import/url-importer';
import type { SongIndexEntry } from '@/types/library';

/** Menos que isso casaria metade do catálogo. */
export const MIN_SITE_QUERY = 3;
export const SEARCH_DEBOUNCE_MS = 300;
const MAX_LIBRARY_RESULTS = 5;
const ALREADY_THERE = 'Pode já estar na biblioteca';

/** Uma fonte de busca: os sitemaps do catálogo, e o CifraClub por fora deles. */
type SiteKey = CatalogSource | 'cifraclub';

/** Pílulas de "buscar em", na ordem em que aparecem. */
const SITE_PILLS: ReadonlyArray<{ key: SiteKey; label: string }> = [
  { key: 'cifraclub', label: 'CifraClub' },
  ...(Object.entries(SOURCE_NAMES) as [CatalogSource, string][]).map(([key, label]) => ({
    key,
    label,
  })),
];
const ALL_SITES: ReadonlySet<SiteKey> = new Set(SITE_PILLS.map((p) => p.key));

/** Na biblioteca vale também um trecho da letra, que é o que se lembra da música. */
function searchLibrary(songs: readonly SongIndexEntry[], query: string): SongIndexEntry[] {
  const normalized = normalizeText(query);
  const tokens = normalized.split(' ').filter(Boolean);
  return songs
    .filter((song) => {
      const name = ` ${normalizeText(`${song.title} ${song.artist ?? ''}`)}`;
      return (
        tokens.every((token) => name.includes(` ${token}`)) ||
        normalizeText(song.lyrics ?? '').includes(normalized)
      );
    })
    .slice(0, MAX_LIBRARY_RESULTS);
}

interface CifraSearchProps {
  songs: readonly SongIndexEntry[];
  /** Abre a revisão com a cifra deste endereço. */
  onImport: (url: string, hint?: PageHint) => Promise<void>;
}

/**
 * Procura de um lugar só: primeiro o que **já está** na biblioteca, depois o que
 * dá para trazer dos sites.
 */
export function CifraSearch({ songs, onImport }: CifraSearchProps) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [sites, setSites] = useState<ReadonlySet<SiteKey>>(ALL_SITES);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const active = query.length >= MIN_SITE_QUERY;
  const inLibrary = useMemo(() => searchLibrary(songs, query), [songs, query]);

  const toggleSite = (key: SiteKey) =>
    setSites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Nunca fica sem nenhum site: tiraria todo mundo da busca sem avisar por quê.
      return next.size > 0 ? next : prev;
    });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Search className="size-4 text-gold-600 dark:text-gold-400" />
        <h2 className="font-display text-xl text-foreground">Procurar uma cifra</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Pelo nome da música ou do artista. Procura na sua biblioteca e nos sites de cifras.
      </p>
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ex.: segura na mão de Deus"
        aria-label="Procurar uma cifra"
      />

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Buscar nesses sites">
        {SITE_PILLS.map(({ key, label }) => {
          const selected = sites.has(key);
          return (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              aria-pressed={selected}
              onClick={() => toggleSite(key)}
              className="h-8 px-3.5 text-xs"
            >
              {label}
            </Button>
          );
        })}
      </div>

      {active && (
        <div className="mt-4 flex flex-col gap-4">
          {inLibrary.length > 0 && (
            <ResultGroup title="Já na sua biblioteca">
              {inLibrary.map((song) => (
                <ResultRow key={song.id} title={song.title} detail={song.artist}>
                  <Button asChild size="sm" variant="ghost" className="gap-1.5">
                    <Link to={`/musica/${song.id}`}>
                      <Library className="size-4" /> Abrir
                    </Link>
                  </Button>
                </ResultRow>
              ))}
            </ResultGroup>
          )}

          <SiteResults
            query={query}
            songs={songs}
            onImport={onImport}
            otherResults={inLibrary.length}
            sites={sites}
          />
        </div>
      )}
    </div>
  );
}

/**
 * O que dá para trazer dos sites para uma busca: o mapa dos sitemaps e as sugestões
 * do CifraClub. Com menos de {@link MIN_SITE_QUERY} letras, não busca nada.
 */
export function SiteResults({
  query,
  songs,
  onImport,
  otherResults = 0,
  sites = ALL_SITES,
}: {
  query: string;
  songs: readonly SongIndexEntry[];
  /** O nome que a busca já conhece vai junto, para o caso de ser preciso colar. */
  onImport: (url: string, hint?: PageHint) => Promise<void> | void;
  /** Resultados de fora daqui: com eles, não cabe dizer que nada foi encontrado. */
  otherResults?: number;
  /** Só busca (e mostra) nos sites marcados. */
  sites?: ReadonlySet<SiteKey>;
}) {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [failed, setFailed] = useState<CatalogSource[]>([]);
  const [cifraClub, setCifraClub] = useState<CifraClubResult[]>([]);
  const [importing, setImporting] = useState<string | null>(null);

  const active = query.length >= MIN_SITE_QUERY;
  const wantsCifraClub = sites.has('cifraclub');

  // O catálogo só é baixado quando alguém procura de fato. `loadCatalog` guarda o
  // que deu certo, então isto só vai à rede de novo para tentar o que falhou.
  useEffect(() => {
    if (!active) return;
    let current = true;
    void loadCatalog().then((loaded) => {
      if (!current) return;
      setCatalog(loaded.entries);
      setFailed(loaded.failed);
    });
    return () => {
      current = false;
    };
  }, [active, query]);

  useEffect(() => {
    if (!active || !wantsCifraClub) {
      setCifraClub([]);
      return;
    }
    const controller = new AbortController();
    void searchCifraClub(query, controller.signal).then((results) => {
      if (!controller.signal.aborted) setCifraClub(results);
    });
    return () => controller.abort();
  }, [active, query, wantsCifraClub]);

  const found = useMemo(
    () =>
      catalog && active
        ? searchCatalog(catalog.filter((e) => sites.has(e.source)), query)
        : [],
    [catalog, active, query, sites],
  );
  const titles = useMemo(() => new Set(songs.map((s) => normalizeTitle(s.title))), [songs]);

  if (!active) return null;

  const handleImport = async (url: string, hint?: PageHint) => {
    setImporting(url);
    try {
      await (hint ? onImport(url, hint) : onImport(url));
    } finally {
      setImporting(null);
    }
  };

  const nothing =
    catalog !== null && otherResults === 0 && found.length === 0 && cifraClub.length === 0;

  return (
    <>
      {catalog === null && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Procurando nos sites…
        </p>
      )}

      {found.length > 0 && (
        <ResultGroup title="Trazer dos sites">
          {found.map((entry) => (
            <ResultRow
              key={entry.url}
              title={entry.title}
              detail={[entry.artist, SOURCE_NAMES[entry.source]].filter(Boolean).join(' · ')}
              badge={titles.has(normalizeTitle(entry.title)) ? ALREADY_THERE : undefined}
            >
              <TrazerButton
                url={entry.url}
                importing={importing}
                onImport={(url) => void handleImport(url)}
              />
            </ResultRow>
          ))}
        </ResultGroup>
      )}

      {cifraClub.length > 0 && (
        <ResultGroup title="No CifraClub">
          {cifraClub.map((result) => (
            <ResultRow
              key={result.url}
              title={result.title}
              detail={result.artist}
              badge={titles.has(normalizeTitle(result.title)) ? ALREADY_THERE : undefined}
            >
              <div className="flex items-center gap-1">
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  aria-label={`Ver ${result.title} no CifraClub`}
                  title="Ver no site"
                >
                  <a href={result.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <TrazerButton
                  url={result.url}
                  importing={importing}
                  onImport={(url) =>
                    void handleImport(url, { title: result.title, artist: result.artist })
                  }
                />
              </div>
            </ResultRow>
          ))}
        </ResultGroup>
      )}

      {failed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sem resposta de {failed.map((s) => SOURCE_NAMES[s]).join(' e ')} agora. Pode haver mais
          resultados.
        </p>
      )}

      {nothing && (
        <p className="text-sm text-muted-foreground">
          Nada encontrado para “{query}”. Tente menos palavras.
        </p>
      )}
    </>
  );
}

function TrazerButton({
  url,
  importing,
  onImport,
}: {
  url: string;
  /** Endereço sendo trazido agora: um de cada vez. */
  importing: string | null;
  onImport: (url: string) => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      disabled={importing !== null}
      onClick={() => onImport(url)}
    >
      {importing === url ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      Trazer
    </Button>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-1.5 flex flex-col divide-y divide-border">{children}</ul>
    </section>
  );
}

function ResultRow({
  title,
  detail,
  badge,
  children,
}: {
  title: string;
  detail?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
        {badge && <p className="text-xs font-semibold text-accent">{badge}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  );
}
