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
  SkipForward,
  Sparkles,
  Wand2,
  Search,
} from 'lucide-react';
import {
  isAiFormatterAvailable,
  formatWithAI,
  generateWithAI,
  findSongCandidates,
  type SongCandidate,
} from '@/lib/import/ai';
import {
  importFile,
  importFromText,
  buildSource,
  splitPastedSongs,
  type ImportedSong,
} from '@/lib/import';
import { SongRenderer } from '@/components/song/SongRenderer';
import { parse } from '@/lib/parser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
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
  // Fila de músicas restantes quando o texto colado tem várias (separadas por ---).
  const [queue, setQueue] = useState<Draft[]>([]);
  const [total, setTotal] = useState(0);
  const [pasteText, setPasteText] = useState('');
  const [pasteFormat, setPasteFormat] = useState('txt');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Gerar música pela IA (pelo nome): buscar candidatas → escolher → gerar.
  const [genTitle, setGenTitle] = useState('');
  const [genArtist, setGenArtist] = useState('');
  const [genKey, setGenKey] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [candidates, setCandidates] = useState<SongCandidate[] | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  // O formatador com IA só aparece se o Worker estiver configurado.
  useEffect(() => {
    isAiFormatterAvailable().then(setAiAvailable);
  }, []);

  /** Inicia a revisão de um lote (1 ou mais músicas). */
  const startBatch = (drafts: Draft[]) => {
    if (drafts.length === 0) return;
    setDraft(drafts[0]!);
    setQueue(drafts.slice(1));
    setTotal(drafts.length);
  };

  /** Formata o texto colado com IA e abre a revisão. */
  const handleFormatAI = async () => {
    if (!pasteText.trim()) return;
    setAiLoading(true);
    setSaveError(null);
    try {
      const { source, warnings } = await formatWithAI(pasteText);
      const imported = importFromText(source, 'cho');
      const draftFromAI = toDraft({ ...imported, warnings: [...warnings, ...imported.warnings] });
      startBatch([draftFromAI]);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Falha ao formatar com IA.');
    } finally {
      setAiLoading(false);
    }
  };

  /** Busca as músicas que a IA conhece com esse nome (para você escolher). */
  const handleSearchCandidates = async () => {
    if (!genTitle.trim()) return;
    setSearchLoading(true);
    setSaveError(null);
    setCandidates(null);
    try {
      setCandidates(await findSongCandidates(genTitle, genArtist || undefined));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Falha ao buscar músicas.');
    } finally {
      setSearchLoading(false);
    }
  };

  /** Gera a cifra da candidata escolhida (usa a 1ª linha para não confundir). */
  const handleGenerateCandidate = async (c: SongCandidate) => {
    setGenLoading(true);
    setSaveError(null);
    try {
      const { source, warnings, confidence } = await generateWithAI({
        title: c.title,
        artist: c.artist || genArtist || undefined,
        key: genKey || c.key || undefined,
        excerpt: c.firstLine || undefined,
      });
      if (!source.trim()) {
        setSaveError('A IA não conseguiu escrever essa música. Tente colar a letra.');
        return;
      }
      // Confiança baixa/média vira um aviso em destaque na revisão.
      const confNote =
        confidence === 'alta'
          ? []
          : [
              confidence === 'baixa'
                ? '⚠ Confiança BAIXA — confira letra e acordes com muito cuidado.'
                : '⚠ Confiança média — confira os acordes, podem variar entre versões.',
            ];
      const imported = importFromText(source, 'cho');
      const draftFromAI = toDraft({
        ...imported,
        warnings: [...confNote, ...warnings, ...imported.warnings],
      });
      startBatch([draftFromAI]);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Falha ao gerar com IA.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      startBatch([toDraft(await importFile(file))]);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    // Divide em várias músicas se houver separadores (---, ===).
    const blocks = splitPastedSongs(pasteText);
    startBatch(blocks.map((block) => toDraft(importFromText(block, pasteFormat))));
  };

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  /** Avança para a próxima da fila, ou encerra o lote. */
  const advance = () => {
    if (queue.length > 0) {
      setDraft(queue[0]!);
      setQueue((q) => q.slice(1));
      setSaveError(null);
    } else {
      setDraft(null);
      setTotal(0);
      setPasteText('');
    }
  };

  const openInEditor = () => {
    if (!draft) return;
    navigate('/editor', { state: { source: draftToSource(draft) } });
  };

  const download = () => {
    if (!draft) return;
    const name = slugify(draft.title || 'musica') || 'musica';
    downloadTextFile(`${name}.cho`, draftToSource(draft));
    advance();
  };

  /** Salva direto na biblioteca. Numa fila, avança; sozinha, abre a música. */
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
      if (queue.length > 0) {
        advance();
      } else {
        navigate(`/musica/${id}`);
      }
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
              placeholder="Cole aqui a cifra (ex.: copiada do CifraClub)…"
              className="font-mono"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Cole o texto da cifra — acordes acima da letra viram inline, e Intro/Refrão são
              reconhecidos. Para importar várias, separe-as com uma linha de{' '}
              <code className="font-mono">---</code>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handlePaste} disabled={!pasteText.trim()} className="gap-1.5">
                Analisar <ArrowRight className="size-4" />
              </Button>
              {aiAvailable && (
                <Button
                  variant="secondary"
                  onClick={handleFormatAI}
                  disabled={!pasteText.trim() || aiLoading}
                  className="gap-1.5"
                  title="Deixa a IA limpar e formatar (útil para textos bagunçados)"
                >
                  {aiLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {aiLoading ? 'Formatando…' : 'Formatar com IA'}
                </Button>
              )}
            </div>
          </div>

          {/* Gerar música pela IA (buscar → escolher → gerar) */}
          {aiAvailable && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <Wand2 className="size-4 text-primary" />
                <Label>Ou peça a música à IA</Label>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Digite o nome e a IA lista as músicas que conhece — você escolhe a certa pela
                primeira linha. Funciona melhor com hinos; sempre revise os acordes.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={genTitle}
                  onChange={(e) => setGenTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleSearchCandidates()}
                  placeholder="Nome da música *"
                />
                <Input
                  value={genArtist}
                  onChange={(e) => setGenArtist(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleSearchCandidates()}
                  placeholder="Artista (opcional)"
                />
                <Input
                  value={genKey}
                  onChange={(e) => setGenKey(e.target.value)}
                  placeholder="Tom (ex.: G)"
                  className="sm:w-24"
                  title="Tom desejado para gerar (opcional)"
                />
              </div>
              <Button
                onClick={handleSearchCandidates}
                disabled={!genTitle.trim() || searchLoading || genLoading}
                className="mt-3 gap-1.5"
              >
                {searchLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {searchLoading ? 'Buscando…' : 'Buscar músicas'}
              </Button>

              {/* Lista de candidatas */}
              {candidates && (
                <div className="mt-4">
                  {candidates.length === 0 ? (
                    <p className="rounded-lg bg-[var(--color-surface-container)] p-3 text-sm text-muted-foreground">
                      A IA não conhece nenhuma música com esse nome com segurança. Tente colar a
                      letra acima e usar <strong className="text-foreground">Formatar com IA</strong>.
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Escolha a sua (clique para gerar):
                      </p>
                      <ul className="flex flex-col gap-2">
                        {candidates.map((c, i) => (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => void handleGenerateCandidate(c)}
                              disabled={genLoading}
                              className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-2">
                                  <span className="font-medium text-foreground">{c.title}</span>
                                  {c.artist && (
                                    <span className="text-xs text-muted-foreground">
                                      {c.artist}
                                    </span>
                                  )}
                                </span>
                                {c.firstLine && (
                                  <span className="mt-0.5 block truncate text-sm italic text-muted-foreground">
                                    “{c.firstLine}…”
                                  </span>
                                )}
                              </span>
                              <ConfidenceBadge level={c.confidence} />
                            </button>
                          </li>
                        ))}
                      </ul>
                      {genLoading && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" /> Gerando a cifra…
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <ReviewForm
          draft={draft}
          position={total - queue.length}
          total={total}
          onUpdate={update}
          onOpenEditor={openInEditor}
          onDownload={download}
          onSave={save}
          onSkip={advance}
          saving={saving}
          saveError={saveError}
          onRestart={() => {
            setDraft(null);
            setQueue([]);
            setTotal(0);
          }}
        />
      )}
    </div>
  );
}

function ReviewForm({
  draft,
  position,
  total,
  onUpdate,
  onOpenEditor,
  onDownload,
  onSave,
  onSkip,
  saving,
  saveError,
  onRestart,
}: {
  draft: Draft;
  position: number;
  total: number;
  onUpdate: (patch: Partial<Draft>) => void;
  onOpenEditor: () => void;
  onDownload: () => void;
  onSave: () => void;
  onSkip: () => void;
  saving: boolean;
  saveError: string | null;
  onRestart: () => void;
}) {
  const previewSong = parse(draftToSource(draft)).song;
  const isBatch = total > 1;

  return (
    <div className="flex flex-col gap-5">
      {isBatch && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-surface-container)] px-3 py-2 text-sm">
          <span className="font-medium text-foreground">
            Música {position} de {total}
          </span>
          <Button variant="ghost" size="sm" onClick={onSkip} className="gap-1.5">
            <SkipForward className="size-4" /> Pular
          </Button>
        </div>
      )}

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

/** Selo de confiança da IA (verde/âmbar/vermelho). */
function ConfidenceBadge({ level }: { level: 'alta' | 'media' | 'baixa' }) {
  const map = {
    alta: { label: 'alta', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
    media: { label: 'média', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    baixa: { label: 'baixa', cls: 'bg-destructive/15 text-destructive' },
  }[level];
  return (
    <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium', map.cls)}>
      {map.label}
    </span>
  );
}
