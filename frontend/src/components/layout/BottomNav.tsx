import { NavLink } from 'react-router';
import { Library, Heart, PenLine, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', icon: Library, label: 'Biblioteca', end: true },
  { to: '/favoritos', icon: Heart, label: 'Favoritos', end: false },
  { to: '/editor', icon: PenLine, label: 'Editor', end: false },
  { to: '/config', icon: Settings, label: 'Config', end: false },
] as const;

export function BottomNav() {
  return (
    <nav className="glass-panel safe-bottom fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-border">
      <div className="mx-auto flex max-w-lg items-center justify-around py-1.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" strokeWidth={isActive ? 2.5 : 1.75} />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
