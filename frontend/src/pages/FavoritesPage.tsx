import { Link } from 'react-router';
import { Heart, Library } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useLibrary } from '@/hooks/useLibrary';
import { SongListItem } from '@/components/library/SongListItem';
import { EmptyState } from '@/components/library/EmptyState';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';

export function FavoritesPage() {
  const { favorites } = useFavorites();
  const { results, isLoading } = useLibrary({ ids: favorites });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <Heart className="size-5 fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">
              Favoritos
            </h1>
            <p className="text-xs text-muted-foreground">
              {favorites.length} {favorites.length === 1 ? 'música' : 'músicas'}
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nenhum favorito ainda"
          description="Toque no coração de uma música para salvá-la aqui."
          action={
            <Button asChild variant="secondary" className="gap-2">
              <Link to="/">
                <Library className="size-4" /> Ir para a biblioteca
              </Link>
            </Button>
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
    </div>
  );
}
