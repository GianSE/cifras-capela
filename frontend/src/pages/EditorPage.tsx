import { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router';
import {
  Download,
  Copy,
  Check,
  Upload,
  AlertTriangle,
  Music,
  FileDown,
  Save,
  Trash2,
  Loader2,
} from 'lucide-react';
import { parse } from '@/lib/parser';
import { SongHeader } from '@/components/song/SongHeader';
import { SongRenderer } from '@/components/song/SongRenderer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadTextFile, slugify } from '@/lib/export/download';
import { buildSongId } from '@/lib/library/derive';
import { songService } from '@/services/song-service';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/** Painel visível no mobile (no desktop os dois aparecem lado a lado). */
type EditorPane = 'edit' | 'preview';

const TEMPLATE = `---
title: Nova Música
artist:
key: G
categories: [culto]
tags: []
language: pt
---

{verso 1}
[G]Digite a letra [C]aqui, com os acordes [D]entre colchetes.

{refrão}
[Em]Cada acorde fica [C]acima da sílaba [G]certa.
`;

const QUICK_CHORDS = ['C', 'D', 'Em', 'G', 'A', 'Am', 'F', 'Dm', 'E', 'B7', 'G7'];
const QUICK_SECTIONS = ['{verso 1}', '{refrão}', '{ponte}', '{intro}'];

export function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { isSignedIn } = useAuth();

  /** Id da música em edição (`/editor/harpa-crista/porque-ele-vive`). Vazio = nova. */
  const editingId = params['*'] || undefined;

  // Pré-carregamento via navigation state (usado pelo importador).
  const stateSource = (location.state as { source?: string } | null)?.source;

  const [source, setSource] = useState(stateSource ?? TEMPLATE);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | undefined>(editingId);
  const [pane, setPane] = useState<EditorPane>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (stateSource) setSource(stateSource);
  }, [stateSource]);

  // Editando uma música existente: carrega o .cho dela.
  useEffect(() => {
    if (!editingId || stateSource) return;
    let mounted = true;
    songService
      .getSongContent(editingId)
      .then((content) => {
        if (mounted) setSource(content);
      })
      .catch(() => {
        if (mounted) setSaveError('Não foi possível carregar esta música.');
      });
    return () => {
      mounted = false;
    };
  }, [editingId, stateSource]);

  const { song, errors } = useMemo(() => parse(source), [source]);
  const warnings = errors.filter((e) => e.severity !== 'error');

  /** Insere texto na posição do cursor da textarea. */
  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      setSource((s) => s + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = source.slice(0, start) + text + source.slice(end);
    setSource(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleDownload = () => {
    const name = slugify(song.metadata.title || 'musica') || 'musica';
    downloadTextFile(`${name}.cho`, source, 'text/plain');
  };

  /**
   * Salva na biblioteca. Numa música nova, o id é derivado do título e da 1ª
   * categoria (`culto/nova-musica`); editando, o id é preservado — assim
   * favoritos, playlists e o tom salvo continuam apontando para ela.
   */
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const id =
        savedId ?? buildSongId(song.metadata.title, song.metadata.categories ?? []);
      await songService.saveSong({ id, source });
      setSavedId(id);
      navigate(`/musica/${id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!savedId) return;
    if (!confirm(`Excluir "${song.metadata.title}" da biblioteca? Isso não pode ser desfeito.`)) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await songService.deleteSong(savedId);
      navigate('/');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível excluir.');
    } finally {
      setSaving(false);
    }
  };

  /** Exporta a cifra em PDF (jsPDF é carregado sob demanda). */
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { exportSongToPdf } = await import('@/lib/export/pdf');
      await exportSongToPdf(song);
    } catch (e) {
      console.error('Falha ao exportar PDF:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  };

  const editor = (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar onInsert={insertAtCursor} />
      <textarea
        ref={textareaRef}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none overflow-y-auto rounded-lg border border-border bg-[var(--color-surface-container-lowest)] p-4 font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Escreva a cifra no formato frontmatter + ChordPro…"
      />
    </div>
  );

  const preview = (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-4">
      {warnings.length > 0 && (
        <div className="mb-3 flex flex-col gap-1 rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-xs text-foreground">
          {warnings.map((w, i) => (
            <span key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" /> {w.message}
            </span>
          ))}
        </div>
      )}
      <SongHeader metadata={song.metadata} displayedKey={song.metadata.key} />
      <SongRenderer song={song} fontSize={17} />
    </div>
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-4 md:px-8 md:py-6">
      {/* Cabeçalho */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Music className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">
              {savedId ? 'Editar música' : 'Nova música'}
            </h1>
            {savedId && <p className="truncate text-xs text-muted-foreground">{savedId}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/importar">
              <Upload className="size-4" /> <span className="hidden lg:inline">Importar</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="hidden lg:inline">{copied ? 'Copiado' : 'Copiar'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="size-4" /> <span className="hidden lg:inline">.cho</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting}
            className="gap-1.5"
            title="Exportar a cifra em PDF"
          >
            <FileDown className="size-4" />
            <span className="hidden lg:inline">{exporting ? 'Gerando…' : 'PDF'}</span>
          </Button>

          {savedId && songService.canWrite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              className="gap-1.5 text-destructive hover:text-destructive"
              title="Excluir da biblioteca"
            >
              <Trash2 className="size-4" /> <span className="hidden lg:inline">Excluir</span>
            </Button>
          )}

          {songService.canWrite && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          )}
        </div>
      </header>

      {/* Avisos de escrita */}
      {saveError && (
        <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </p>
      )}
      {!songService.canWrite && (
        <p className="mb-3 rounded-lg bg-[var(--color-surface-container)] p-3 text-xs text-muted-foreground">
          Biblioteca somente leitura. Configure o Supabase para salvar músicas pelo app — por
          enquanto, use <strong className="text-foreground">.cho</strong> e coloque o arquivo em{' '}
          <code>frontend/public/songs/</code>.
        </p>
      )}
      {songService.canWrite && !isSignedIn && (
        <p className="mb-3 rounded-lg bg-[var(--color-surface-container)] p-3 text-xs text-muted-foreground">
          Você precisa{' '}
          <Link to="/config" className="font-medium text-primary underline">
            entrar
          </Link>{' '}
          para salvar alterações.
        </p>
      )}

      {/* Alternador Editar/Prévia — apenas no mobile */}
      <Tabs
        value={pane}
        onValueChange={(v) => setPane(v as EditorPane)}
        className="mb-3 md:hidden"
      >
        <TabsList className="self-start">
          <TabsTrigger value="edit">Editar</TabsTrigger>
          <TabsTrigger value="preview">Prévia</TabsTrigger>
        </TabsList>
      </Tabs>

      {/*
        Desktop: split em 2 colunas. Mobile: mostra só o painel ativo.
        Cada painel é renderizado UMA vez (evita textarea duplicada/ref
        compartilhada). `min-h-0` é essencial: sem ele os itens do grid usam
        `min-height: auto` e crescem até a altura do conteúdo em vez de rolar.
      */}
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
        <div className={cn('flex min-h-0 flex-col', pane !== 'edit' && 'hidden md:flex')}>
          {editor}
        </div>
        <div className={cn('flex min-h-0 flex-col', pane !== 'preview' && 'hidden md:flex')}>
          {preview}
        </div>
      </div>
    </div>
  );
}

function Toolbar({ onInsert }: { onInsert: (text: string) => void }) {
  return (
    <div className="mb-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {QUICK_CHORDS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onInsert(`[${c}]`)}
          className={cn(
            'shrink-0 rounded-md bg-[var(--color-surface-container-high)] px-2.5 py-1 font-mono text-sm font-semibold text-accent transition-colors hover:bg-[var(--color-surface-container-highest)]',
          )}
        >
          {c}
        </button>
      ))}
      <span className="mx-1 w-px shrink-0 bg-border" />
      {QUICK_SECTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onInsert(`\n${s}\n`)}
          className="shrink-0 rounded-md bg-[var(--color-surface-container-high)] px-2.5 py-1 font-mono text-xs text-primary transition-colors hover:bg-[var(--color-surface-container-highest)]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
