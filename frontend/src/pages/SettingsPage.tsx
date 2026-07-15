import { Settings, Sun, Moon, Monitor, Trash2, Info } from 'lucide-react';
import { usePreferences } from '@/hooks/usePreferences';
import { preferencesStorage, type ThemePreference } from '@/lib/storage/preferences';
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
              min={0.25}
              max={3}
              step={0.25}
              onValueChange={(v) => preferencesStorage.update({ autoScrollSpeed: v[0] ?? 1 })}
            />
          </Row>
        </Section>

        {/* Dados */}
        <Section title="Dados locais">
          <Row label="Favoritos" hint={`${prefs.favorites.length} salvos`}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => preferencesStorage.update({ favorites: [] })}
              disabled={prefs.favorites.length === 0}
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
            offline, seus dados ficam apenas neste dispositivo. As músicas vivem em arquivos{' '}
            <code className="font-mono">.cho</code> versionados no Git.
          </p>
        </div>
      </div>
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
