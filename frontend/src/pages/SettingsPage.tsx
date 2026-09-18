import { Link } from 'react-router';
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Info,
  ListMusic,
  Download,
  Check,
} from 'lucide-react';
import { usePreferences } from '@/hooks/usePreferences';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useAuth } from '@/hooks/useAuth';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { preferencesStorage, type ThemePreference } from '@/lib/storage/preferences';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionTitle } from '@/components/layout/SectionTitle';
import { OfflineNotice } from '@/components/layout/OfflineNotice';
import { Button } from '@/components/ui/button';
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
            <div className="flex w-full gap-1 rounded-full bg-[var(--color-surface-container-high)] p-1 sm:w-auto">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => preferencesStorage.update({ theme: value })}
                  className={cn(
                    // Em telas bem estreitas o texto encolhe antes de vazar do card.
                    'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors sm:flex-none sm:gap-1.5 sm:px-3 sm:text-sm',
                    prefs.theme === value
                      ? 'bg-[image:var(--gradient-gold)] text-navy-900 shadow-gilded'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" /> <span className="truncate">{label}</span>
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
            offline. Preferências e tons ficam neste dispositivo; as músicas ficam no servidor, e
            as playlists sincronizam quando você entra na conta.
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Conta de quem entrou. Só informa: entrar e sair moram no menu do perfil, no
 * canto da barra de cima — ter dois lugares para a mesma saída só confundia.
 */
function AccountRow() {
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading || !user) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <Row label={user.name || user.email} hint={user.email}>
      <span className="shrink-0 rounded-full border border-gold-500/35 bg-[color-mix(in_srgb,var(--color-gold-400)_10%,transparent)] px-2.5 py-1 text-xs font-semibold text-gold-700 dark:text-gold-400">
        {isAdmin ? 'Administrador' : 'Somente leitura'}
      </span>
    </Row>
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
    // `flex-wrap`: num celular estreito o controle (o seletor de tema, por
    // exemplo) não cabe ao lado do rótulo e passava por cima da borda do card.
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="break-words text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
