import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Upload,
  FileText,
  AlertTriangle,
  ArrowRight,
  Download,
  Loader2,
  Save,
  Undo2,
  Search,
  Link as LinkIcon,
  Copy,
} from 'lucide-react';
import { importFromUrl, isUrlImportAvailable } from '@/lib/import/url-importer';
import { ACCEPTED_FILE_TYPES, importFile, buildSource, type ImportedSong } from '@/lib/import';
import { SongRenderer } from '@/components/song/SongRenderer';
import { PageHeader } from '@/components/layout/PageHeader';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { parse } from '@/lib/parser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadTextFile, slugify } from '@/lib/export/download';
import { parseYoutubeId, youtubeThumbnailUrl } from '@/lib/youtube';
import { VideoLinkDialog } from '@/components/video/VideoLinkDialog';
import { buildSongId, nextFreeSongId } from '@/lib/library/derive';
import { songService } from '@/services/song-service';
import { useSongLibrary } from '@/hooks/useSongLibrary';

/** Casas em que o capo pode ficar — o menu da revisão vai da 1ª à 12ª. */
const CAPO_FRETS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Draft {
  title: string;
  artist: string;
  key: string;
  categories: string;
  tags: string;
  language: string;
  tempo: string;
  capo: string;
  /** Link (ou id) do vídeo no YouTube, como a pessoa colou. */
  youtube: string;
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
    youtube: s.youtube ? `https://youtu.be/${s.youtube}` : '',
    body: s.body,
    warnings: s.warnings,
  };
}

function draftToSource(d: Draft): string {
  const imported: ImportedSong = {
    title: d.title,
    artist: d.artist || undefined,
    key: d.key || undefined,
    categories: d.categories
      ? d.categories
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : undefined,
    tags: d.tags
      ? d.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined,
    language: d.language || undefined,
    tempo: d.tempo ? Number.parseInt(d.tempo, 10) : undefined,
    capo: d.capo ? Number.parseInt(d.capo, 10) : undefined,
    youtube: parseYoutubeId(d.youtube),
    body: d.body,
    warnings: [],
  };
  return buildSource(imported);
}

export function ImportPage() {
  const navigate = useNavigate();
  const { songs } = useSongLibrary();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pageUrl, setPageUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlAvailable, setUrlAvailable] = useState(false);
  /** Id que já existe na biblioteca e está para ser sobrescrito. */
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Falha ao ler o link ou o arquivo — aparece na tela inicial, não na revisão. */
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    // Importar por link depende do Worker; em `vite dev` puro ele não existe.
    isUrlImportAvailable().then(setUrlAvailable);
  }, []);

  /** Abre a revisão de uma música importada. */
  const startReview = (imported: ImportedSong) => {
    setDraft(toDraft(imported));
    setSaveError(null);
    setImportError(null);
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setOcrProgress(null);
    setImportError(null);
    try {
      const isImage = /\.(jpe?g|png)$/i.test(file.name);
      startReview(await importFile(file, isImage ? (f) => setOcrProgress(f) : undefined));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Não foi possível ler esse arquivo.');
    } finally {
      setLoading(false);
      setOcrProgress(null);
    }
  };

  /** Busca a página pelo Worker e abre a revisão com o que veio de lá. */
  const handleUrl = async () => {
    if (!pageUrl.trim()) return;
    setUrlLoading(true);
    setImportError(null);
    try {
      startReview(await importFromUrl(pageUrl.trim()));
      setPageUrl('');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Não foi possível ler essa página.');
    } finally {
      setUrlLoading(false);
    }
  };

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  /** Volta para a tela inicial, descartando a revisão. */
  const restart = () => {
    setDraft(null);
    setSaveError(null);
  };

  const openInEditor = () => {
    if (!draft) return;
    navigate('/editor', { state: { source: draftToSource(draft) } });
  };

  const download = () => {
    if (!draft) return;
    const name = slugify(draft.title || 'musica') || 'musica';
    downloadTextFile(`${name}.cho`, draftToSource(draft));
    restart();
  };

  /** Id que esta revisão vai ocupar na biblioteca. */
  const draftId = (d: Draft): string =>
    buildSongId(
      d.title,
      d.categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    );

  /** Grava de fato, no id informado. */
  const writeSong = async (id: string) => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await songService.saveSong({ id, source: draftToSource(draft) });
      setConflictId(null);
      navigate(`/musica/${id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Salva na biblioteca. O id vem do título + categoria, e gravar é `upsert`:
   * se já existir música com esse id, salvar em silêncio apagaria a versão
   * antiga — inclusive correções feitas à mão. Nesse caso, pergunta antes.
   */
  const save = async () => {
    if (!draft) return;
    const id = draftId(draft);
    if (songs.some((s) => s.id === id)) {
      setConflictId(id);
      return;
    }
    await writeSong(id);
  };

  return (
    <RequireAuth
      title="Entre para importar músicas"
      description="Importar salva na sua biblioteca sincronizada, e isso exige login."
    >
      <>
        <PageHeader
          title="Importar cifra"
          icon={Upload}
          contentWidth="max-w-3xl"
          subtitle="Traga de um link, de um arquivo ou de uma foto da folha"
        />
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
          {!draft ? (
            <div className="flex flex-col gap-5">
              {importError && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {importError}
                </p>
              )}

              {/* Link da cifra — o caminho mais curto, então vem primeiro. */}
              {urlAvailable && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="mb-1 flex items-center gap-2">
                    <LinkIcon className="size-4 text-gold-600 dark:text-gold-400" />
                    <h2 className="font-display text-xl text-foreground">Colar o link da cifra</h2>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Cole o endereço da página (CifraClub e sites parecidos) e o app busca a
                    cifra para você revisar.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="url"
                      inputMode="url"
                      value={pageUrl}
                      onChange={(e) => setPageUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleUrl()}
                      placeholder="https://www.cifraclub.com.br/..."
                    />
                    <Button
                      onClick={() => void handleUrl()}
                      disabled={urlLoading || !pageUrl.trim()}
                      className="shrink-0 gap-1.5"
                    >
                      {urlLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                      {urlLoading ? 'Buscando…' : 'Buscar'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload de arquivo */}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-outline)] bg-card px-6 py-12 text-center transition-colors hover:border-gold-500">
                {loading ? (
                  <Loader2 className="size-8 animate-spin text-gold-600 dark:text-gold-400" />
                ) : (
                  <FileText className="size-8 text-muted-foreground" />
                )}
                <div>
                  <p className="font-display text-xl text-foreground">Selecione um arquivo</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    .pdf · .cho · .jpg · .png
                  </p>
                  {loading && ocrProgress !== null && (
                    <p className="mt-1 text-xs text-primary">
                      {`Reconhecendo texto na imagem… ${Math.round(ocrProgress * 100)}%`}
                    </p>
                  )}
                </div>
                <input
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    // Limpa a seleção: escolher o mesmo arquivo de novo precisa disparar.
                    e.target.value = '';
                    if (file) void handleFile(file);
                  }}
                />
              </label>
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
              onRestart={restart}
            />
          )}
        </div>

        {/* Já existe música com este id — salvar por cima apagaria a antiga. */}
        <Dialog open={conflictId !== null} onOpenChange={(open) => !open && setConflictId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Essa música já existe</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Já há{' '}
              <strong className="text-foreground">
                {songs.find((s) => s.id === conflictId)?.title ?? conflictId}
              </strong>{' '}
              em <code className="font-mono text-xs">{conflictId}</code>. Substituir apaga a
              versão que está lá, inclusive correções feitas à mão.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void writeSong(nextFreeSongId(conflictId ?? '', songs.map((s) => s.id)))}
                className="justify-start gap-2"
              >
                <Copy className="size-4" /> Guardar como nova
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setConflictId(null)}
                className="justify-start gap-2"
              >
                <Undo2 className="size-4" /> Voltar e ajustar o título
              </Button>
              <Button
                variant="destructive"
                disabled={saving}
                onClick={() => void writeSong(conflictId ?? '')}
                className="justify-start gap-2"
              >
                <Save className="size-4" /> Substituir a que está lá
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    </RequireAuth>
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

      {draft.warnings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-xs text-foreground">
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
          <Input
            value={draft.categories}
            onChange={(e) => onUpdate({ categories: e.target.value })}
          />
        </Field>
        {/* BPM e Tags saíram da revisão: ninguém os preenche ao importar. Se o
            arquivo de origem já trouxer, continuam sendo gravados — só não
            ocupam mais o formulário. */}
        <Field label="Capo">
          {/* Menu em vez de texto livre: capo só existe da 1ª à 12ª casa, e
              digitar "2ª", "casa 2" ou "II" não daria um número válido. */}
          <select
            value={draft.capo}
            onChange={(e) => onUpdate({ capo: e.target.value })}
            className="flex h-11 w-full rounded-xl border border-input bg-[var(--color-surface-container-lowest)] px-4 text-sm text-foreground transition-colors hover:border-[var(--color-outline)] focus-visible:border-gold-500"
          >
            <option value="">Sem capo</option>
            {CAPO_FRETS.map((fret) => (
              <option key={fret} value={String(fret)}>
                {fret}ª casa
              </option>
            ))}
          </select>
        </Field>
      </div>

      <VideoField draft={draft} onUpdate={onUpdate} />

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

/**
 * Vídeo da música na revisão. Vindo do CifraClub já chega preenchido; senão,
 * o atalho abre a busca no YouTube com título e artista.
 */
function VideoField({
  draft,
  onUpdate,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<Draft>) => void;
}) {
  const videoId = parseYoutubeId(draft.youtube);
  const invalid = draft.youtube.trim() !== '' && !videoId;
  const [searching, setSearching] = useState(false);

  return (
    <Field label="Vídeo do YouTube (opcional)">
      <div className="flex gap-3">
        {videoId && (
          <img
            src={youtubeThumbnailUrl(videoId)}
            alt=""
            className="hidden aspect-video h-[4.5rem] shrink-0 rounded-lg border border-border bg-muted object-cover sm:block"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              inputMode="url"
              value={draft.youtube}
              onChange={(e) => onUpdate({ youtube: e.target.value })}
              placeholder="https://youtu.be/..."
              aria-invalid={invalid}
            />
            <Button
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={() => setSearching(true)}
            >
              <Search className="size-4" /> Procurar
            </Button>
          </div>

          {/* A mesma busca do leitor: aqui ela só preenche o campo — quem grava
              é o "Salvar na biblioteca" da revisão. */}
          <VideoLinkDialog
            open={searching}
            onOpenChange={setSearching}
            title={draft.title || 'cifra'}
            artist={draft.artist || undefined}
            videoId={videoId}
            canEdit
            saveLabel="Usar este vídeo"
            onSave={(id) =>
              Promise.resolve(onUpdate({ youtube: id ? `https://youtu.be/${id}` : '' }))
            }
          />
          <p className={invalid ? 'mt-1 text-xs text-destructive' : 'mt-1 text-xs text-muted-foreground'}>
            {invalid
              ? 'Não reconheci esse link — o vídeo não será salvo.'
              : videoId
                ? 'O vídeo aparece na música e nos cards para ouvir antes de tocar.'
                : 'Cole o link para ouvir a música antes de tocar.'}
          </p>
        </div>
      </div>
    </Field>
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
