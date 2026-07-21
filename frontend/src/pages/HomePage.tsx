import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Music, SearchX, Clock, Plus } from 'lucide-react';
import { useLibrary } from '@/hooks/useLibrary';
import { useHistory } from '@/hooks/useHistory';
import { useEditAccess } from '@/hooks/useEditAccess';
import { SearchBar } from '@/components/library/SearchBar';
import { FilterChips } from '@/components/library/FilterChips';
import { SongListItem } from '@/components/library/SongListItem';
import { SongCard } from '@/components/library/SongCard';
import { EmptyState } from '@/components/library/EmptyState';
import { Button } from '@/components/ui/button';

export function HomePage() {
  const [query, setQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>([]);

  const { songs, results, allCategories, isLoading } = useLibrary({
    query,
    categories: activeCategories,
  });
  const { recentSongs } = useHistory();
  const { showEditUI } = useEditAccess();

  const recentEntries = useMemo(() => {
    const byId = new Map(songs.map((s) => [s.id, s]));
    return recentSongs.map((id) => byId.get(id)).filter((s) => s !== undefined).slice(0, 8);
  }, [songs, recentSongs]);

  const toggleCategory = (c: string) =>
    setActiveCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const isBrowsing = query.trim() === '' && activeCategories.length === 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-6">
      {/* Cabeçalho */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Music className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">
              Minha Biblioteca
            </h1>
            <p className="text-xs text-muted-foreground">
              {songs.length} {songs.length === 1 ? 'música' : 'músicas'}
            </p>
          </div>
        </div>
        {showEditUI && (
          <div className="flex items-center gap-1">
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/editor">
                <Plus className="size-4" /> <span className="hidden sm:inline">Nova</span>
              </Link>
            </Button>
          </div>
        )}
      </header>

      {/* Busca */}
      <SearchBar value={query} onChange={setQuery} className="mb-3" />

      {/* Filtros por categoria */}
      <FilterChips options={allCategories} active={activeCategories} onToggle={toggleCategory} className="mb-5" />

      {/* Recentes */}
      {isBrowsing && recentEntries.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Clock className="size-4" /> Abertas recentemente
          </h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recentEntries.map((song) => (
              <SongCard key={song.id} song={song} />
            ))}
          </div>
        </section>
      )}

      {/* Lista de resultados */}
      <section>
        {!isBrowsing && (
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          </h2>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nenhuma música encontrada"
            description={
              songs.length === 0
                ? 'Adicione arquivos .cho em public/songs para começar.'
                : 'Tente outro termo ou remova os filtros.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((song) => (
              <li key={song.id}>
                <SongListItem song={song} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
