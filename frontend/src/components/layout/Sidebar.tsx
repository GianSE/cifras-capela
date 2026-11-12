import { Link, useLocation } from 'react-router';
import { Music, ListMusic, Upload, Library } from 'lucide-react';
import { useEditAccess } from '@/hooks/useEditAccess';
import { useMoreItems } from './MoreMenu';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Playlists', path: '/playlists', icon: ListMusic },
  { name: 'Biblioteca', path: '/home', icon: Library },
  { name: 'Importar', path: '/importar', icon: Upload },
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
 *
 * Sem o botão "Mais": no trilho cabe todo mundo, ícone a ícone — esse atalho
 * é só para o espaço curto da navegação do celular. A conta de quem entrou
 * também não mora aqui: já está na barra de cima, nos dois tamanhos de tela.
 */
export function Sidebar() {
  const { pathname } = useLocation();
  const { showEditUI } = useEditAccess();
  const moreItems = useMoreItems();

  const isActive = (path: string) => pathname.startsWith(path);

  // Importar e as telas do "Mais" (Folhas, Usuários) só para quem escreve.
  const items = [
    ...NAV_ITEMS.filter((item) => item.path !== '/importar' || showEditUI),
    ...moreItems.map(({ to, label, icon }) => ({ name: label, path: to, icon })),
  ];

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
      </div>
    </aside>
  );
}
