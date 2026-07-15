import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { HomePage } from '@/pages/HomePage';

// Rotas pesadas carregadas sob demanda (code-splitting).
const FavoritesPage = lazy(() =>
  import('@/pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })),
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

export function App() {
  // Mantém o tema (claro/escuro/sistema) aplicado e reativo em todo o app.
  useTheme();

  return (
    <TooltipProvider delayDuration={300}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Rotas com a "casca" do app (sidebar + navegação inferior) */}
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="favoritos" element={<FavoritesPage />} />
            <Route path="editor" element={<EditorPage />} />
            <Route path="importar" element={<ImportPage />} />
            <Route path="config" element={<SettingsPage />} />
          </Route>

          {/* Leitor em tela cheia, sem a casca do app (foco total) */}
          <Route path="musica/*" element={<SongPage />} />
        </Routes>
      </Suspense>
    </TooltipProvider>
  );
}
