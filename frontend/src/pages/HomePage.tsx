import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { SearchX, History, Plus, Library, Star } from 'lucide-react';
import { useLibrary } from '@/hooks/useLibrary';
import { useHistory } from '@/hooks/useHistory';
import { useEditAccess } from '@/hooks/useEditAccess';
import { useFavorites } from '@/hooks/useFavorites';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { OfflineNotice } from '@/components/layout/OfflineNotice';
import { SectionTitle } from '@/components/layout/SectionTitle';
import { SearchBar } from '@/components/library/SearchBar';
import { CategoryFilter } from '@/components/library/CategoryFilter';
import { filterChipClass } from '@/components/library/filter-chip';
import { SongListItem } from '@/components/library/SongListItem';
import { EmptyState } from '@/components/library/EmptyState';
import { Button } from '@/components/ui/button';

/** Quantas músicas o filtro "Recentes" mostra. */
const RECENT_LIMIT = 10;

/** Filtro de coleção pessoal: só um por vez, combinável com busca e categoria. */
type Collection = 'favorites' | 'recents' | null;

export function HomePage() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [collection, setCollection] = useState<Collection>(null);

  const { favorites } = useFavorites();
  const { recentSongs } = useHistory();
  const { showEditUI } = useEditAccess();

  const { songs, results, allCategories, isLoading, source, staleSince } = useLibrary({
    query,
    categories: activeCategory ? [activeCategory] : [],
    ids:
      collection === 'favorites' ? favorites : collection === 'recents' ? recentSongs : undefined,
    keepIdOrder: collection === 'recents',
    maxIds: collection === 'recents' ? RECENT_LIMIT : undefined,
  });

  const hasRecents = useMemo(() => {
    const existing = new Set(songs.map((s) => s.id));
    return recentSongs.some((id) => existing.has(id));
  }, [songs, recentSongs]);

  const toggle = (value: Exclude<Collection, null>) =>
    setCollection((current) => (current === value ? null : value));

  const onlyFavorites = collection === 'favorites';
  const onlyRecents = collection === 'recents';
  const isBrowsing = query.trim() === '' && !activeCategory && !collection;

  return (
    <>
      <PageHeader
        title="Minha Biblioteca"
        icon={Library}
        subtitle={`${songs.length} ${songs.length === 1 ? 'música' : 'músicas'} para tocar e cantar`}
        actions={
          showEditUI && (
            <Button asChild variant="gold" size="sm" className="gap-1.5">
              <Link to="/editor">
                <Plus className="size-4" /> <span className="hidden sm:inline">Nova</span>
              </Link>
            </Button>
          )
        }
      >
        <SearchBar value={query} onChange={setQuery} />
        <CategoryFilter
          options={allCategories}
          active={activeCategory}
          onChange={setActiveCategory}
          className="mt-3"
          leading={
            <>
              {hasRecents && (
                <button
                  type="button"
                  onClick={() => toggle('recents')}
                  aria-pressed={onlyRecents}
                  className={filterChipClass(onlyRecents)}
                >
                  <History className="size-4" />
                  Recentes
                </button>
              )}
              {favorites.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggle('favorites')}
                  aria-pressed={onlyFavorites}
                  className={filterChipClass(onlyFavorites)}
                >
                  <Star className={cn('size-4', onlyFavorites && 'fill-current')} />
                  Favoritas
                </button>
              )}
            </>
          }
        />
      </PageHeader>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
        <OfflineNotice source={source} staleSince={staleSince} />

        {/* Lista de resultados */}
        <section>
          <SectionTitle
            aside={
              isBrowsing
                ? undefined
                : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`
            }
          >
            {isBrowsing
              ? 'Todas as músicas'
              : onlyFavorites && !query
                ? 'Favoritas'
                : onlyRecents && !query
                  ? 'Recentes'
                  : 'Busca'}
          </SectionTitle>

          {isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[70px] animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={onlyFavorites ? Star : onlyRecents ? History : SearchX}
              title={
                onlyFavorites
                  ? 'Nenhuma favorita por aqui'
                  : onlyRecents
                    ? 'Nenhuma recente por aqui'
                    : 'Nenhuma música encontrada'
              }
              description={
                songs.length === 0
                  ? 'Adicione arquivos .cho em public/songs para começar.'
                  : onlyFavorites
                    ? 'Suas favoritas não batem com a busca ou a categoria escolhida.'
                    : onlyRecents
                      ? 'Suas últimas músicas não batem com a busca ou a categoria escolhida.'
                    : 'Tente outro termo ou remova os filtros.'
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {results.map((song) => (
                <li key={song.id}>
                  <SongListItem song={song} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
