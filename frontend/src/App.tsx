import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { useEditAccess } from '@/hooks/useEditAccess';
import { useAuth } from '@/hooks/useAuth';
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
const UsersPage = lazy(() => import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })));

function PageFallback() {
  return (
    <div className="flex h-dvh items-center justify-center text-muted-foreground">
      <span className="animate-pulse">Carregando…</span>
    </div>
  );
}

/**
 * Guard das telas do app: com ninguém logado, manda para a
 * entrada (`/`), lembrando de onde veio. Quem já entrou passa direto — um
 * link para uma música abre a música.
 */
function RequireEntry() {
  const { needsLogin, isLoading } = useEditAccess();
  const location = useLocation();

  if (isLoading) return <PageFallback />;
  if (needsLogin) {
    const from = location.pathname + location.search;
    return <Navigate to="/" replace state={{ from }} />;
  }
  return <Outlet />;
}

/**
 * `/` é a porta de entrada do site: quem chega pelo endereço principal vê o
 * login primeiro. Quem já tem sessão válida segue direto para a biblioteca —
 * pedir a senha de novo a quem acabou de entrar não protege nada.
 */
function EntryRoute() {
  const { isSignedIn, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageFallback />;
  if (isSignedIn) {
    const from = (location.state as { from?: string } | null)?.from ?? '/home';
    return <Navigate to={from} replace />;
  }
  return <LoginPage />;
}

/** `/login` virou `/`; o antigo continua valendo para links e favoritos salvos. */
/** Telas de administrador: quem só lê volta para a biblioteca. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return <PageFallback />;
  return isAdmin ? <>{children}</> : <Navigate to="/home" replace />;
}

function LegacyLoginRedirect() {
  const location = useLocation();
  return <Navigate to="/" replace state={location.state} />;
}

export function App() {
  // Mantém o tema (claro/escuro/sistema) aplicado e reativo em todo o app.
  useTheme();

  return (
    <TooltipProvider delayDuration={300}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Entrada (fora do guard): o endereço principal abre o login */}
          <Route index element={<EntryRoute />} />
          <Route path="login" element={<LegacyLoginRedirect />} />

          {/* Tudo o mais exige ter entrado */}
          <Route element={<RequireEntry />}>
            {/* Rotas com a "casca" do app (sidebar + navegação inferior) */}
            <Route element={<AppShell />}>
              <Route path="home" element={<HomePage />} />
              <Route path="playlists" element={<PlaylistsPage />} />
              <Route path="playlists/:id" element={<PlaylistPage />} />
              {/* `editor/*` aceita ids com barra: /editor/harpa-crista/porque-ele-vive */}
              <Route path="editor/*" element={<EditorPage />} />
              <Route path="importar" element={<ImportPage />} />
              <Route path="config" element={<SettingsPage />} />
              <Route
                path="usuarios"
                element={
                  <RequireAdmin>
                    <UsersPage />
                  </RequireAdmin>
                }
              />
            </Route>

            {/* Leitor em tela cheia, sem a casca do app (foco total) */}
            <Route path="musica/*" element={<SongPage />} />
          </Route>
        </Routes>
      </Suspense>
    </TooltipProvider>
  );
}
