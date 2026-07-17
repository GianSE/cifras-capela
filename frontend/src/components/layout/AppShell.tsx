import { Outlet } from 'react-router';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar (desktop/tablet) */}
      <Sidebar />

      {/* Área principal */}
      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      {/* Navegação inferior (mobile) */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
