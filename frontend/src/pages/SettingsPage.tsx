import { Link } from 'react-router';
import { Settings, Sun, Moon, Monitor, Trash2, Info, ListMusic, LogOut } from 'lucide-react';
import { usePreferences } from '@/hooks/usePreferences';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useAuth } from '@/hooks/useAuth';
import { songService } from '@/services/song-service';
import { preferencesStorage, type ThemePreference } from '@/lib/storage/preferences';
import { Button } from '@/components/ui/button';
import { SignInForm } from '@/components/auth/SignInForm';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function SettingsPage() {
  const prefs = usePreferences();
  const playlists = usePlaylists();
  const transposedCount = Object.keys(prefs.transpositions).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 md:px-8 md:py-6">
      <header className="mb-6 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Settings className="size-5" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Configurações</h1>
      </header>

      <div className="flex flex-col gap-6">
        {/* Aparência */}
        <Section title="Aparência">
          <Row label="Tema">
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => preferencesStorage.update({ theme: value })}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    prefs.theme === value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Música */}
        <Section title="Música">
          <Row label="Preferir bemóis (♭)" hint="Ex.: Db em vez de C#">
            <Switch
              checked={prefs.preferFlats}
              onCheckedChange={(checked) => preferencesStorage.update({ preferFlats: checked })}
            />
          </Row>
          <Separator />
          <Row label={`Tamanho da fonte: ${prefs.fontSize}px`}>
            <Slider
              className="w-40"
              value={[prefs.fontSize]}
              min={12}
              max={40}
              step={2}
              onValueChange={(v) => preferencesStorage.update({ fontSize: v[0] ?? 18 })}
            />
          </Row>
          <Separator />
          <Row label={`Velocidade da rolagem: ${prefs.autoScrollSpeed.toFixed(2)}×`}>
            <Slider
              className="w-40"
              value={[prefs.autoScrollSpeed]}
              min={0.1}
              max={3}
              step={0.1}
              onValueChange={(v) => preferencesStorage.update({ autoScrollSpeed: v[0] ?? 1 })}
            />
          </Row>
        </Section>

        {/* Conta — só faz sentido quando o Supabase está configurado */}
        <Section title="Conta">
          <AccountRow />
        </Section>

        {/* Dados */}
        <Section title="Dados locais">
          <Row
            label="Playlists"
            hint={`${playlists.length} ${playlists.length === 1 ? 'playlist' : 'playlists'}`}
          >
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/playlists">
                <ListMusic className="size-4" /> Gerenciar
              </Link>
            </Button>
          </Row>
          <Separator />
          <Row
            label="Tons salvos"
            hint={`${transposedCount} ${transposedCount === 1 ? 'música transposta' : 'músicas transpostas'}`}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => preferencesStorage.clearTranspositions()}
              disabled={transposedCount === 0}
              className="gap-1.5"
            >
              <Trash2 className="size-4" /> Limpar
            </Button>
          </Row>
          <Separator />
          <Row label="Histórico" hint={`${prefs.recentSongs.length} recentes`}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => preferencesStorage.clearRecents()}
              disabled={prefs.recentSongs.length === 0}
              className="gap-1.5"
            >
              <Trash2 className="size-4" /> Limpar
            </Button>
          </Row>
        </Section>

        {/* Sobre */}
        <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="text-foreground">Minha Biblioteca de Cifras</strong> — funciona
            offline. Preferências, playlists e tons ficam neste dispositivo.{' '}
            {songService.canWrite
              ? 'As músicas são sincronizadas na sua conta.'
              : 'As músicas vivem em arquivos .cho versionados no Git.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Login por magic link. Só aparece quando o Supabase está configurado —
 * é ele que autoriza criar/editar músicas (ler é público).
 */
function AccountRow() {
  const { isEnabled, isSignedIn, session, signOut, isLoading } = useAuth();

  if (!isEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Biblioteca somente leitura. Configure o Supabase (veja{' '}
        <code className="font-mono text-xs">frontend/.env.example</code>) para criar e editar
        músicas pelo app, sincronizadas entre o celular e o PC.
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (isSignedIn) {
    return (
      <Row label="Conectado" hint={session?.user.email ?? undefined}>
        <Button variant="outline" size="sm" onClick={() => void signOut()} className="gap-1.5">
          <LogOut className="size-4" /> Sair
        </Button>
      </Row>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Entre para criar e editar músicas.</p>
      <SignInForm />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
