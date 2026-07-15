import { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router';
import { Download, Copy, Check, Upload, AlertTriangle, Music } from 'lucide-react';
import { parse } from '@/lib/parser';
import { SongHeader } from '@/components/song/SongHeader';
import { SongRenderer } from '@/components/song/SongRenderer';
import { Button } from '@/components/ui/button';
import { downloadTextFile, slugify } from '@/lib/export/download';
import { cn } from '@/lib/utils';

type MobilePane = 'edit' | 'preview';

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
  // Permite pré-carregar via navigation state (usado pelo importador).
  const initial = (location.state as { source?: string } | null)?.source ?? TEMPLATE;

  const [source, setSource] = useState(initial);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if ((location.state as { source?: string } | null)?.source) {
      setSource((location.state as { source: string }).source);
    }
  }, [location.state]);

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
    <div className="flex h-full flex-col">
      <Toolbar onInsert={insertAtCursor} />
      <textarea
        ref={textareaRef}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        className="min-h-64 flex-1 resize-none rounded-lg border border-border bg-[var(--color-surface-container-lowest)] p-4 font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Escreva a cifra no formato frontmatter + ChordPro…"
      />
    </div>
  );

  const preview = (
    <div className="h-full overflow-y-auto rounded-lg border border-border bg-card p-4">
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
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Music className="size-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Editor</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/importar">
              <Upload className="size-4" /> <span className="hidden sm:inline">Importar</span>
            </Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
          </Button>
          <Button size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="size-4" /> <span className="hidden sm:inline">Baixar .cho</span>
          </Button>
        </div>
      </header>

      {/* Desktop: split | Mobile: tabs */}
      <div className="hidden min-h-0 flex-1 grid-cols-2 gap-4 md:grid">
        {editor}
        {preview}
      </div>

      <Tabs defaultValue="edit" className="flex min-h-0 flex-1 flex-col md:hidden">
        <TabsList className="mb-3 self-start">
          <TabsTrigger value="edit">Editar</TabsTrigger>
          <TabsTrigger value="preview">Prévia</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="min-h-0 flex-1">
          {editor}
        </TabsContent>
        <TabsContent value="preview" className="min-h-0 flex-1">
          {preview}
        </TabsContent>
      </Tabs>
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
