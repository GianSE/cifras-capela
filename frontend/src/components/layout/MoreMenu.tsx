import { useNavigate } from 'react-router';
import { Settings, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
 * para administradores, as contas). Antes o Config ocupava um lugar fixo na
 * barra; agora divide espaço com o que vier depois.
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
  const items = useMoreItems();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-48">
        {items.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} onSelect={() => navigate(to)}>
            <Icon /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
