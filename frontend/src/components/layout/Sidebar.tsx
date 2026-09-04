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
const RAIL = 'w-[72px]';

/** Classes do rótulo: some quando recolhido, aparece suave ao expandir. */
const LABEL =
  'whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100';

/**
 * Sidebar em trilho: mostra apenas os ícones e expande ao passar o mouse.
 *
 * É a "espinha" azul do app — fica no azul do manto nos dois temas, para o
 * conteúdo em marfim respirar ao lado e o dourado dos ativos se destacar.
 *
 * O `<aside>` é só um espaçador de 72px no fluxo; o painel de verdade é
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
          'bg-[image:var(--gradient-blue)] text-navy-100',
          // No tema escuro o fundo da página também é azul: o fio dourado é o
          // que mantém o trilho separado do conteúdo.
          'border-r border-gold-400/15 dark:border-gold-400/30',
          'transition-[width,box-shadow] duration-300 ease-out',
          'hover:w-64 hover:shadow-floating focus-within:w-64 focus-within:shadow-floating',
        )}
      >
        {/* Marca */}
        <div className="flex h-20 shrink-0 items-center border-b border-white/10 px-3.5">
          <span className="grid size-11 shrink-0 place-items-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-[image:var(--gradient-gold)] text-navy-900 shadow-gilded">
              <Music className="size-5" />
            </span>
          </span>
          <span className={cn(LABEL, 'flex flex-col leading-tight')}>
            <strong className="font-display text-xl text-ivory">Cifras</strong>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-gold-400">
              Capela
            </span>
          </span>
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
                  'relative flex h-12 shrink-0 items-center rounded-full transition-colors',
                  active
                    ? 'bg-white/10 text-gold-300'
                    : 'text-navy-200 hover:bg-white/6 hover:text-ivory',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[image:var(--gradient-gold)]" />
                )}
                <span className="grid size-12 shrink-0 place-items-center">
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className={cn(LABEL, 'text-sm font-semibold')}>{name}</span>
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

  // Enquanto a sessão carrega, mantém o rótulo simples.
  if (!isEnabled) {
    return (
      <div className="shrink-0 border-t border-white/10 p-3">
        <span className={cn(LABEL, 'block px-1 text-xs text-navy-200')}>Offline • local</span>
      </div>
    );
  }

  const email = session?.user.email ?? '';
  const name = isSignedIn ? email.split('@')[0] || 'Conta' : 'Convidado';
  const sub = isSignedIn ? email : 'Somente leitura';

  return (
    <div className="shrink-0 border-t border-white/10 p-3">
      <div className="flex items-center">
        <span className="grid size-12 shrink-0 place-items-center" title={sub}>
          <span className="flex size-9 items-center justify-center rounded-full border border-gold-400/30 bg-white/8 text-gold-300">
            <UserRound className="size-4" />
          </span>
        </span>
        <div className={cn(LABEL, 'flex min-w-0 flex-1 items-center gap-1')}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ivory">{name}</p>
            <p className="truncate text-xs text-navy-200">{sub}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleExit()}
            title="Sair"
            aria-label="Sair"
            className="grid size-9 shrink-0 place-items-center rounded-full text-navy-200 transition-colors hover:bg-white/10 hover:text-gold-300"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
