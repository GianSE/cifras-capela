import { useLocation, useNavigate } from 'react-router';
import { Settings, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Destinos do menu "Mais". Usuários é só para administradores. */
export function useMoreItems() {
  const { isAdmin } = useAuth();
  return [
    { to: '/config', label: 'Config', icon: Settings },
    ...(isAdmin ? [{ to: '/usuarios', label: 'Usuários', icon: Users }] : []),
  ];
}

/**
 * Botão "Mais" da navegação: guarda o que não é do dia a dia (configurações e,
 * para administradores, as contas).
 *
 * Os destinos vêm como cards numa grade de até três por linha — alvo grande
 * para o dedo e com o ícone bem visível, em vez de uma lista fina de texto.
 */
export function MoreMenu({
  trigger,
  align = 'end',
  side,
}: {
  trigger: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const items = useMoreItems();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-auto p-2">
        {/* Uma coluna por item até três; com um item só, o card não estica. */}
        <div
          className={cn(
            'grid gap-2',
            items.length >= 3 ? 'grid-cols-3' : items.length === 2 ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <DropdownMenuItem
                key={to}
                onSelect={() => navigate(to)}
                className={cn(
                  'w-[5.5rem] flex-col gap-2 rounded-xl border p-3 text-center',
                  active
                    ? 'border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)]'
                    : 'border-border hover:border-gold-400/60',
                )}
              >
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-full [&_svg]:size-5',
                    active
                      ? 'bg-[image:var(--gradient-gold)] text-navy-900 shadow-gilded'
                      : 'bg-navy-700 text-gold-300',
                  )}
                >
                  <Icon />
                </span>
                <span className="text-xs font-semibold text-foreground">{label}</span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
