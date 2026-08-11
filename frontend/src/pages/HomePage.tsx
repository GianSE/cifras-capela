import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { SearchX, Clock, Plus, Library, Star } from 'lucide-react';
import { useLibrary } from '@/hooks/useLibrary';
import { useHistory } from '@/hooks/useHistory';
import { useEditAccess } from '@/hooks/useEditAccess';
import { useFavorites } from '@/hooks/useFavorites';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionTitle } from '@/components/layout/SectionTitle';
import { SearchBar } from '@/components/library/SearchBar';
import { CategoryFilter } from '@/components/library/CategoryFilter';
import { filterChipClass } from '@/components/library/filter-chip';
import { SongListItem } from '@/components/library/SongListItem';
import { SongCard } from '@/components/library/SongCard';
import { EmptyState } from '@/components/library/EmptyState';
import { Button } from '@/components/ui/button';

export function HomePage() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const { favorites } = useFavorites();

  const { songs, results, allCategories, isLoading } = useLibrary({
    query,
    categories: activeCategory ? [activeCategory] : [],
    ids: onlyFavorites ? favorites : undefined,
  });
  const { recentSongs } = useHistory();
  const { showEditUI } = useEditAccess();

  const recentEntries = useMemo(() => {
    const byId = new Map(songs.map((s) => [s.id, s]));
    return recentSongs
      .map((id) => byId.get(id))
      .filter((s) => s !== undefined)
      .slice(0, 8);
  }, [songs, recentSongs]);

  const isBrowsing = query.trim() === '' && !activeCategory && !onlyFavorites;

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
            favorites.length > 0 && (
              <button
                type="button"
                onClick={() => setOnlyFavorites((v) => !v)}
                aria-pressed={onlyFavorites}
                className={filterChipClass(onlyFavorites)}
              >
                <Star className={cn('size-4', onlyFavorites && 'fill-current')} />
                Favoritas
              </button>
            )
          }
        />
      </PageHeader>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
        {/* Recentes */}
        {isBrowsing && recentEntries.length > 0 && (
          <section className="mb-8">
            <SectionTitle icon={Clock}>Abertas recentemente</SectionTitle>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recentEntries.map((song) => (
                <SongCard key={song.id} song={song} />
              ))}
            </div>
          </section>
        )}

        {/* Lista de resultados */}
        <section>
          <SectionTitle
            aside={
              isBrowsing
                ? undefined
                : `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`
            }
          >
            {isBrowsing ? 'Todas as músicas' : onlyFavorites && !query ? 'Favoritas' : 'Busca'}
          </SectionTitle>

          {isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[70px] animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={onlyFavorites ? Star : SearchX}
              title={
                onlyFavorites ? 'Nenhuma favorita por aqui' : 'Nenhuma música encontrada'
              }
              description={
                songs.length === 0
                  ? 'Adicione arquivos .cho em public/songs para começar.'
                  : onlyFavorites
                    ? 'Suas favoritas não batem com a busca ou a categoria escolhida.'
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
