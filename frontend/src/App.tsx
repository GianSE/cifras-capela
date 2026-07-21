import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { useEditAccess } from '@/hooks/useEditAccess';
import { useGuestMode } from '@/hooks/useGuestMode';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';

// Rotas pesadas carregadas sob demanda (code-splitting).
const PlaylistsPage = lazy(() =>
  import('@/pages/PlaylistsPage').then((m) => ({ default: m.PlaylistsPage })),
);
const PlaylistPage = lazy(() =>
  import('@/pages/PlaylistPage').then((m) => ({ default: m.PlaylistPage })),
);
const SongPage = lazy(() => import('@/pages/SongPage').then((m) => ({ default: m.SongPage })));
const EditorPage = lazy(() =>
  import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage })),
);
const ImportPage = lazy(() =>
  import('@/pages/ImportPage').then((m) => ({ default: m.ImportPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function PageFallback() {
  return (
    <div className="flex h-dvh items-center justify-center text-muted-foreground">
      <span className="animate-pulse">Carregando…</span>
    </div>
  );
}

/**
 * Guard de entrada: com o Supabase ligado e ninguém logado (nem convidado),
 * redireciona para `/login`. Quem já entrou (a sessão persiste) ou já escolheu
 * convidado passa direto. `/login` fica fora deste guard.
 */
function RequireEntry() {
  const { needsLogin, isLoading } = useEditAccess();
  const { isGuest } = useGuestMode();
  const location = useLocation();

  if (isLoading) return <PageFallback />;
  if (needsLogin && !isGuest) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}

export function App() {
  // Mantém o tema (claro/escuro/sistema) aplicado e reativo em todo o app.
  useTheme();

  return (
    <TooltipProvider delayDuration={300}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Entrada (fora do guard) */}
          <Route path="login" element={<LoginPage />} />

          {/* Tudo o mais exige ter entrado (ou ser convidado) */}
          <Route element={<RequireEntry />}>
            {/* Rotas com a "casca" do app (sidebar + navegação inferior) */}
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="playlists" element={<PlaylistsPage />} />
              <Route path="playlists/:id" element={<PlaylistPage />} />
              {/* `editor/*` aceita ids com barra: /editor/harpa-crista/porque-ele-vive */}
              <Route path="editor/*" element={<EditorPage />} />
              <Route path="importar" element={<ImportPage />} />
              <Route path="config" element={<SettingsPage />} />
            </Route>

            {/* Leitor em tela cheia, sem a casca do app (foco total) */}
            <Route path="musica/*" element={<SongPage />} />
          </Route>
        </Routes>
      </Suspense>
    </TooltipProvider>
  );
}
