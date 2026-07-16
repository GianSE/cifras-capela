import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Upload, FileText, AlertTriangle, ArrowRight, Download, Loader2, Save } from 'lucide-react';
import { importFile, importFromText, buildSource, type ImportedSong } from '@/lib/import';
import { SongRenderer } from '@/components/song/SongRenderer';
import { parse } from '@/lib/parser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { downloadTextFile, slugify } from '@/lib/export/download';
import { buildSongId } from '@/lib/library/derive';
import { songService } from '@/services/song-service';

interface Draft {
  title: string;
  artist: string;
  key: string;
  categories: string;
  tags: string;
  language: string;
  tempo: string;
  capo: string;
  body: string;
  warnings: string[];
}

function toDraft(s: ImportedSong): Draft {
  return {
    title: s.title ?? '',
    artist: s.artist ?? '',
    key: s.key ?? '',
    categories: (s.categories ?? []).join(', '),
    tags: (s.tags ?? []).join(', '),
    language: s.language ?? 'pt',
    tempo: s.tempo?.toString() ?? '',
    capo: s.capo?.toString() ?? '',
    body: s.body,
    warnings: s.warnings,
  };
}

function draftToSource(d: Draft): string {
  const imported: ImportedSong = {
    title: d.title,
    artist: d.artist || undefined,
    key: d.key || undefined,
    categories: d.categories ? d.categories.split(',').map((c) => c.trim()).filter(Boolean) : undefined,
    tags: d.tags ? d.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    language: d.language || undefined,
    tempo: d.tempo ? Number.parseInt(d.tempo, 10) : undefined,
    capo: d.capo ? Number.parseInt(d.capo, 10) : undefined,
    body: d.body,
    warnings: [],
  };
  return buildSource(imported);
}

export function ImportPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteFormat, setPasteFormat] = useState('txt');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      setDraft(toDraft(await importFile(file)));
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    setDraft(toDraft(importFromText(pasteText, pasteFormat)));
  };

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const openInEditor = () => {
    if (!draft) return;
    navigate('/editor', { state: { source: draftToSource(draft) } });
  };

  const download = () => {
    if (!draft) return;
    const name = slugify(draft.title || 'musica') || 'musica';
    downloadTextFile(`${name}.cho`, draftToSource(draft));
  };

  /** Salva direto na biblioteca e abre a música. */
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const categories = draft.categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const id = buildSongId(draft.title, categories);
      await songService.saveSong({ id, source: draftToSource(draft) });
      navigate(`/musica/${id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4 md:px-8 md:py-6">
      <header className="mb-5 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Upload className="size-5" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Importar cifra</h1>
      </header>

      {!draft ? (
        <div className="flex flex-col gap-5">
          {/* Upload de arquivo */}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-12 text-center transition-colors hover:border-primary">
            {loading ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : (
              <FileText className="size-8 text-muted-foreground" />
            )}
            <div>
              <p className="font-semibold text-foreground">Selecione um arquivo</p>
              <p className="mt-1 text-sm text-muted-foreground">
                .txt · .md · .html · .json · .pdf · .cho
              </p>
            </div>
            <input
              type="file"
              accept=".txt,.md,.markdown,.html,.htm,.json,.pdf,.cho,.chordpro,.chopro,text/*,application/json,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>

          {/* Colar texto */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label>Ou cole o texto</Label>
              <select
                value={pasteFormat}
                onChange={(e) => setPasteFormat(e.target.value)}
                className="h-9 rounded-md border border-border bg-[var(--color-surface-container-high)] px-2 text-sm text-foreground"
              >
                <option value="txt">Texto</option>
                <option value="cho">ChordPro</option>
                <option value="md">Markdown</option>
                <option value="html">HTML</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              placeholder="Cole aqui a cifra…"
              className="font-mono"
            />
            <Button onClick={handlePaste} disabled={!pasteText.trim()} className="mt-3 gap-1.5">
              Analisar <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <ReviewForm
          draft={draft}
          onUpdate={update}
          onOpenEditor={openInEditor}
          onDownload={download}
          onSave={save}
          saving={saving}
          saveError={saveError}
          onRestart={() => setDraft(null)}
        />
      )}
    </div>
  );
}

function ReviewForm({
  draft,
  onUpdate,
  onOpenEditor,
  onDownload,
  onSave,
  saving,
  saveError,
  onRestart,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
  onOpenEditor: () => void;
  onDownload: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  onRestart: () => void;
}) {
  const previewSong = parse(draftToSource(draft)).song;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Revise os dados extraídos antes de salvar. Ajuste o que for necessário.
      </p>

      {saveError && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{saveError}</p>
      )}
      {!songService.canWrite && (
        <p className="rounded-lg bg-[var(--color-surface-container)] p-3 text-xs text-muted-foreground">
          Biblioteca somente leitura. Configure o Supabase para salvar pelo app — por enquanto,
          baixe o <strong className="text-foreground">.cho</strong> e coloque em{' '}
          <code>frontend/public/songs/</code>.
        </p>
      )}

      {draft.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-xs text-foreground">
          {draft.warnings.map((w, i) => (
            <span key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" /> {w}
            </span>
          ))}
        </div>
      )}

      {/* Metadados */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Título" className="col-span-2">
          <Input value={draft.title} onChange={(e) => onUpdate({ title: e.target.value })} />
        </Field>
        <Field label="Artista">
          <Input value={draft.artist} onChange={(e) => onUpdate({ artist: e.target.value })} />
        </Field>
        <Field label="Tom">
          <Input value={draft.key} onChange={(e) => onUpdate({ key: e.target.value })} />
        </Field>
        <Field label="Categorias (vírgula)">
          <Input value={draft.categories} onChange={(e) => onUpdate({ categories: e.target.value })} />
        </Field>
        <Field label="Tags (vírgula)">
          <Input value={draft.tags} onChange={(e) => onUpdate({ tags: e.target.value })} />
        </Field>
        <Field label="BPM">
          <Input value={draft.tempo} inputMode="numeric" onChange={(e) => onUpdate({ tempo: e.target.value })} />
        </Field>
        <Field label="Capo">
          <Input value={draft.capo} inputMode="numeric" onChange={(e) => onUpdate({ capo: e.target.value })} />
        </Field>
      </div>

      <Field label="Corpo (ChordPro)">
        <Textarea
          value={draft.body}
          onChange={(e) => onUpdate({ body: e.target.value })}
          rows={8}
          className="font-mono"
        />
      </Field>

      {/* Prévia */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Prévia
        </p>
        <SongRenderer song={previewSong} fontSize={16} />
      </div>

      <div className="flex flex-wrap gap-2">
        {songService.canWrite && (
          <Button onClick={onSave} disabled={saving || !draft.title.trim()} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? 'Salvando…' : 'Salvar na biblioteca'}
          </Button>
        )}
        <Button variant="secondary" onClick={onOpenEditor} className="gap-1.5">
          Abrir no editor <ArrowRight className="size-4" />
        </Button>
        <Button variant="secondary" onClick={onDownload} className="gap-1.5">
          <Download className="size-4" /> Baixar .cho
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          Recomeçar
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
