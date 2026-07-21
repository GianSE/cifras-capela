import { Link, useLocation, useNavigate } from 'react-router';
import { Music, ListMusic, PenLine, Settings, Library, UserRound, LogOut } from 'lucide-react';
import { useEditAccess } from '@/hooks/useEditAccess';
import { useAuth } from '@/hooks/useAuth';
import { useGuestMode } from '@/hooks/useGuestMode';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Biblioteca', path: '/', icon: Library },
  { name: 'Playlists', path: '/playlists', icon: ListMusic },
  { name: 'Editor', path: '/editor', icon: PenLine },
  { name: 'Configurações', path: '/config', icon: Settings },
] as const;

/** Largura do trilho recolhido (só ícones). */
const RAIL = 'w-[68px]';

/** Classes do rótulo: some quando recolhido, aparece suave ao expandir. */
const LABEL =
  'whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100';

/**
 * Sidebar em trilho: mostra apenas os ícones e expande ao passar o mouse.
 *
 * O `<aside>` é só um espaçador de 68px no fluxo; o painel de verdade é
 * `absolute` dentro dele, então ao expandir ele **sobrepõe** o conteúdo em vez
 * de empurrá-lo. Também expande via `focus-within` (navegação por teclado).
 */
export function Sidebar() {
  const { pathname } = useLocation();
  const { showEditUI } = useEditAccess();

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  // O Editor só aparece para quem pode escrever (logado, ou modo arquivo).
  const items = NAV_ITEMS.filter((item) => item.path !== '/editor' || showEditUI);

  return (
    <aside className={cn('relative hidden shrink-0 md:block', RAIL)}>
      <div
        className={cn(
          'group absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden',
          RAIL,
          'border-r border-border bg-[var(--color-surface-container-lowest)]',
          'transition-[width,box-shadow] duration-300 ease-out',
          'hover:w-64 hover:shadow-2xl focus-within:w-64 focus-within:shadow-2xl',
        )}
      >
        {/* Marca */}
        <div className="flex h-16 shrink-0 items-center border-b border-border px-3">
          <span className="grid size-11 shrink-0 place-items-center">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Music className="size-5" />
            </span>
          </span>
          <span className={cn(LABEL, 'font-bold tracking-tight text-foreground')}>Cifras</span>
        </div>

        {/* Navegação */}
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {items.map(({ name, path, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                title={name}
                className={cn(
                  'relative flex h-11 shrink-0 items-center rounded-lg transition-colors',
                  active
                    ? 'bg-[var(--color-surface-container)] text-primary'
                    : 'text-muted-foreground hover:bg-[var(--color-surface-hover)] hover:text-foreground',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <span className="grid size-11 shrink-0 place-items-center">
                  <Icon className="size-5" />
                </span>
                <span className={cn(LABEL, 'text-sm font-medium')}>{name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: conta / convidado */}
        <SidebarAccount />
      </div>
    </aside>
  );
}

/** Perfil de quem está usando (logado ou convidado) + botão de sair. */
function SidebarAccount() {
  const { isEnabled, isSignedIn, session, signOut } = useAuth();
  const { clearGuest } = useGuestMode();
  const navigate = useNavigate();

  const handleExit = async () => {
    if (isSignedIn) await signOut();
    else clearGuest();
    navigate('/login', { replace: true });
  };

  // Sem Supabase não há conta — mantém o rótulo simples.
  if (!isEnabled) {
    return (
      <div className="shrink-0 border-t border-border p-3">
        <span className={cn(LABEL, 'block px-1 text-xs text-muted-foreground')}>
          Offline • local
        </span>
      </div>
    );
  }

  const email = session?.user.email ?? '';
  const name = isSignedIn ? email.split('@')[0] || 'Conta' : 'Convidado';
  const sub = isSignedIn ? email : 'Somente leitura';

  return (
    <div className="shrink-0 border-t border-border p-3">
      <div className="flex items-center">
        <span className="grid size-11 shrink-0 place-items-center" title={sub}>
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-container-high)] text-muted-foreground">
            <UserRound className="size-4" />
          </span>
        </span>
        <div className={cn(LABEL, 'flex min-w-0 flex-1 items-center gap-1')}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleExit()}
            title="Sair"
            aria-label="Sair"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--color-surface-hover)] hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
