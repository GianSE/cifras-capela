import { Link, useLocation } from 'react-router';
import { Music, Heart, PenLine, Settings, Library } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Biblioteca', path: '/', icon: Library },
  { name: 'Favoritos', path: '/favoritos', icon: Heart },
  { name: 'Editor', path: '/editor', icon: PenLine },
  { name: 'Configurações', path: '/config', icon: Settings },
] as const;

export function Sidebar() {
  const { pathname } = useLocation();

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-[var(--color-surface-container-lowest)] md:flex">
      {/* Marca */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Music className="size-5" />
        </div>
        <span className="font-bold tracking-tight text-foreground">Cifras</span>
      </div>

      {/* Navegação */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ name, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-[var(--color-surface-container)] text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-[var(--color-surface-hover)] hover:text-foreground',
              )}
            >
              <Icon className="size-5" />
              {name}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div className="flex items-center justify-between border-t border-border p-3">
        <span className="px-2 text-xs text-muted-foreground">Offline • local</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
