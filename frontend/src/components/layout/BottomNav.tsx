import { NavLink } from 'react-router';
import { Library, ListMusic, PenLine, Settings } from 'lucide-react';
import { useEditAccess } from '@/hooks/useEditAccess';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', icon: Library, label: 'Biblioteca', end: true },
  { to: '/playlists', icon: ListMusic, label: 'Playlists', end: false },
  { to: '/editor', icon: PenLine, label: 'Editor', end: false },
  { to: '/config', icon: Settings, label: 'Config', end: false },
] as const;

/**
 * Navegação inferior do celular. Azul do manto com fio dourado no topo — o
 * mesmo par de cores da sidebar, para o app ter a mesma moldura nos dois
 * tamanhos de tela.
 */
export function BottomNav() {
  const { showEditUI } = useEditAccess();
  const items = NAV_ITEMS.filter((item) => item.to !== '/editor' || showEditUI);

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-[var(--z-sticky)] bg-[image:var(--gradient-blue)] shadow-floating">
      {/* Fio dourado — assina a barra e a separa do conteúdo. */}
      <div aria-hidden className="h-[3px] bg-[image:var(--gradient-gold)]" />

      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-w-16 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors',
                isActive ? 'bg-white/10 text-gold-300' : 'text-navy-200 hover:text-ivory',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" strokeWidth={isActive ? 2.5 : 1.75} />
                <span className="text-[10px] font-semibold tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
