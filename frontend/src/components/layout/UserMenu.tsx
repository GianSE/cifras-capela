import { useNavigate } from 'react-router';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Conta de quem está usando, à direita da barra de cima: diz quem entrou, o
 * que a conta pode fazer e oferece a saída. Fica na barra azul, então usa as
 * variantes claras.
 */
export function UserMenu({ className }: { className?: string }) {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleExit = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const firstName = user.name.split(' ')[0] || user.email.split('@')[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Conta de ${user.name || user.email}`}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-full border border-white/20 py-1 pl-1 pr-2.5 text-navy-100 transition-colors hover:border-gold-400/60 hover:text-ivory',
            className,
          )}
        >
          <span className="grid size-7 place-items-center rounded-full bg-white/10 text-gold-300">
            <UserRound className="size-4" />
          </span>
          <span className="hidden max-w-28 truncate text-sm font-semibold sm:block">
            {firstName}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <span className="mt-1.5 inline-block rounded-full border border-gold-500/35 bg-[color-mix(in_srgb,var(--color-gold-400)_10%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-gold-700 dark:text-gold-400">
            {isAdmin ? 'Administrador' : 'Somente leitura'}
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void handleExit()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
