import { Link } from 'react-router';
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Info,
  ListMusic,
  LogOut,
  Download,
  Check,
} from 'lucide-react';
import { usePreferences } from '@/hooks/usePreferences';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useAuth } from '@/hooks/useAuth';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { songService } from '@/services/song-service';
import { preferencesStorage, type ThemePreference } from '@/lib/storage/preferences';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionTitle } from '@/components/layout/SectionTitle';
import { OfflineNotice } from '@/components/layout/OfflineNotice';
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
    <>
      <PageHeader
        title="Configurações"
        icon={Settings}
        contentWidth="max-w-2xl"
        subtitle="Aparência, música e dados guardados neste aparelho"
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-6 md:px-8">
        <OfflineNotice />

        {/* No aparelho */}
        <Section title="No aparelho">
          <InstallRow />
        </Section>

        {/* Aparência */}
        <Section title="Aparência">
          <Row label="Tema">
            <div className="flex gap-1 rounded-full bg-[var(--color-surface-container-high)] p-1">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => preferencesStorage.update({ theme: value })}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                    prefs.theme === value
                      ? 'bg-[image:var(--gradient-gold)] text-navy-900 shadow-gilded'
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

        {/* Conta — é ela que libera criar e editar músicas */}
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
            label="Favoritas"
            hint={`${prefs.favorites.length} ${prefs.favorites.length === 1 ? 'música marcada' : 'músicas marcadas'}`}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => preferencesStorage.clearFavorites()}
              disabled={prefs.favorites.length === 0}
              className="gap-1.5"
            >
              <Trash2 className="size-4" /> Limpar
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
        <div className="flex items-start gap-2.5 rounded-2xl border border-gold-500/30 bg-[color-mix(in_srgb,var(--color-gold-400)_8%,transparent)] p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-gold-600 dark:text-gold-400" />
          <p>
            <strong className="text-foreground">Minha Biblioteca de Cifras</strong> — funciona
            offline. Preferências, playlists e tons ficam neste dispositivo.{' '}
            {songService.canWrite
              ? 'As músicas são sincronizadas na sua conta.'
              : 'As músicas vivem em arquivos .cho versionados no Git.'}
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Login com e-mail e senha: é ele que autoriza criar e editar músicas.
 * Ler é público — quem abre o app não precisa entrar para ver as cifras.
 */
function AccountRow() {
  const { isSignedIn, session, signOut, isLoading } = useAuth();

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

/**
 * Instalar na tela inicial — é o que faz o app abrir em tela cheia e
 * funcionar sem rede. O iOS não expõe o evento de instalação, então lá só dá
 * para explicar o caminho manual.
 */
function InstallRow() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  if (installed) {
    return (
      <Row label="App instalado" hint="Abre em tela cheia e funciona sem internet.">
        <Check className="size-5 text-gold-600 dark:text-gold-400" />
      </Row>
    );
  }

  if (canInstall) {
    return (
      <Row
        label="Instalar na tela inicial"
        hint="Abre em tela cheia e funciona sem internet."
      >
        <Button size="sm" className="gap-1.5" onClick={() => void promptInstall()}>
          <Download className="size-4" /> Instalar
        </Button>
      </Row>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Para usar sem internet, adicione o app à tela inicial pelo menu do navegador — no
      iPhone, <strong className="text-foreground">Compartilhar › Adicionar à Tela de Início</strong>.
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-soft">
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
