import { NavLink, useLocation } from 'react-router';
import { Library, ListMusic, MoreHorizontal, PenLine } from 'lucide-react';
import { useEditAccess } from '@/hooks/useEditAccess';
import { MoreMenu, useMoreItems } from './MoreMenu';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/home', icon: Library, label: 'Biblioteca', end: true },
  { to: '/playlists', icon: ListMusic, label: 'Playlists', end: false },
  { to: '/editor', icon: PenLine, label: 'Editor', end: false },
] as const;

/** Mesmo visual dos itens fixos, para o "Mais" não destoar ao lado deles. */
const ITEM =
  'flex min-w-16 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors';

/**
 * Navegação inferior do celular. Azul do manto com fio dourado no topo — o
 * mesmo par de cores da sidebar, para o app ter a mesma moldura nos dois
 * tamanhos de tela.
 */
export function BottomNav() {
  const { showEditUI } = useEditAccess();
  const { pathname } = useLocation();
  const items = NAV_ITEMS.filter((item) => item.to !== '/editor' || showEditUI);
  const moreItems = useMoreItems();
  const moreActive = moreItems.some((item) => pathname.startsWith(item.to));

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-white/10 bg-[image:var(--gradient-blue)] shadow-floating">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(ITEM, isActive ? 'bg-white/10 text-gold-300' : 'text-navy-200 hover:text-ivory')
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

        <MoreMenu
          side="top"
          align="end"
          trigger={
            <button
              type="button"
              aria-label="Mais opções"
              className={cn(
                ITEM,
                moreActive ? 'bg-white/10 text-gold-300' : 'text-navy-200 hover:text-ivory',
              )}
            >
              <MoreHorizontal className="size-5" strokeWidth={moreActive ? 2.5 : 1.75} />
              <span className="text-[10px] font-semibold tracking-wide">Mais</span>
            </button>
          }
        />
      </div>
    </nav>
  );
}
