import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Code2,
  ListMusic,
  Music,
  Plus,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addChord,
  chordRow,
  editLyric,
  getField,
  isChordOnly,
  lineSegments,
  lyricLine,
  mergeLines,
  moveChord,
  nudgeChord,
  parseDocument,
  parseLyricLine,
  removeChord,
  sectionLine,
  sectionName,
  serializeDocument,
  setChord,
  setField,
  splitLine,
  usedChords,
  type ChoDocument,
  type DocLine,
  type LyricLine,
  type SectionLine,
} from '@/lib/editor/cho-document';
import { HARMONIC_FIELDS } from '@/lib/editor/harmonic-fields';
import { parseChordString } from '@/lib/transpose/chord-parser';
import { cn } from '@/lib/utils';

export type EditorMode = 'letra' | 'acordes' | 'codigo';

const MODE_KEY = 'cifras-capela:editor-modo';
const MAX_UNDO = 100;
/** Digitar em sequência conta como um passo só para o Desfazer. */
const TYPING_GROUP_MS = 800;
const CAPO_FRETS = Array.from({ length: 12 }, (_, i) => i + 1);

const NEW_SECTIONS = [
  ['Verso', 'verso'],
  ['Refrão', 'refrão'],
  ['Ponte', 'ponte'],
  ['Intro', 'intro'],
  ['Final', 'final'],
] as const;

function readMode(): EditorMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'acordes' || stored === 'codigo' || stored === 'letra') return stored;
  } catch {
    // Sem armazenamento, vale o padrão.
  }
  return 'letra';
}

/** O documento em edição, com o Desfazer. O `.cho` de fora continua mandando. */
function useChoDocument(value: string, onChange: (next: string) => void) {
  const [doc, setDoc] = useState<ChoDocument>(() => parseDocument(value));
  const lastEmitted = useRef(value);
  const undoStack = useRef<ChoDocument[]>([]);
  const lastTyping = useRef<{ lineId: number; at: number } | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Mudou por fora (modo .cho, outra música carregada): relê e zera o histórico.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setDoc(parseDocument(value));
    undoStack.current = [];
    lastTyping.current = null;
    setCanUndo(false);
  }, [value]);

  const apply = useCallback(
    (next: ChoDocument) => {
      setDoc(next);
      const text = serializeDocument(next);
      lastEmitted.current = text;
      onChange(text);
    },
    [onChange],
  );

  const commit = useCallback(
    (current: ChoDocument, next: ChoDocument, typingLineId?: number) => {
      const now = Date.now();
      const sameTyping =
        typingLineId !== undefined &&
        lastTyping.current?.lineId === typingLineId &&
        now - lastTyping.current.at < TYPING_GROUP_MS;
      if (!sameTyping) {
        undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), current];
        setCanUndo(true);
      }
      lastTyping.current = typingLineId !== undefined ? { lineId: typingLineId, at: now } : null;
      apply(next);
    },
    [apply],
  );

  const undo = useCallback(() => {
    const previous = undoStack.current[undoStack.current.length - 1];
    if (!previous) return;
    undoStack.current = undoStack.current.slice(0, -1);
    lastTyping.current = null;
    setCanUndo(undoStack.current.length > 0);
    apply(previous);
  }, [apply]);

  return { doc, commit, undo, canUndo };
}

interface ChoEditorProps {
  /** O texto do `.cho`. */
  value: string;
  onChange: (next: string) => void;
  /** O editor de texto puro, com `[G]` no meio da letra (o modo `.cho`). */
  codeEditor: ReactNode;
  /** Mostra título, artista, tom… (quem edita só o corpo não precisa). */
  showFields?: boolean;
  /** Começa com esses dados abertos. Numa música que já existe, a tela é da letra. */
  fieldsOpen?: boolean;
  /** Tom, para sugerir o campo harmônico (se o frontmatter não for deste arquivo). */
  songKey?: string;
  className?: string;
}

/**
 * Editor de cifra sem colchetes. Por baixo é sempre o mesmo `.cho`:
 *  - **Letra**: cada linha é um campo, e os acordes acompanham a sílaba;
 *  - **Acordes**: a letra fica travada, e se toca nela para pôr acordes;
 *  - **.cho**: o texto cru, para quem prefere digitar `[G]`.
 */
export function ChoEditor({
  value,
  onChange,
  codeEditor,
  showFields = false,
  fieldsOpen = false,
  songKey,
  className,
}: ChoEditorProps) {
  const [mode, setModeState] = useState<EditorMode>(readMode);
  const { doc, commit, undo, canUndo } = useChoDocument(value, onChange);

  const setMode = (next: EditorMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Sem armazenamento, a escolha vale até sair da tela.
    }
  };

  const replaceLine = useCallback(
    (line: DocLine, typing = false) => {
      commit(
        doc,
        { ...doc, lines: doc.lines.map((l) => (l.id === line.id ? line : l)) },
        typing ? line.id : undefined,
      );
    },
    [doc, commit],
  );

  const key = songKey ?? (getField(value, 'key') || undefined);

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div
          role="radiogroup"
          aria-label="Modo de edição"
          className="flex rounded-full border border-[var(--color-outline)] p-0.5"
        >
          <ModeButton mode="letra" current={mode} onSelect={setMode} icon={Type} label="Letra" />
          <ModeButton
            mode="acordes"
            current={mode}
            onSelect={setMode}
            icon={Music}
            label="Acordes"
          />
          <ModeButton mode="codigo" current={mode} onSelect={setMode} icon={Code2} label=".cho" />
        </div>
        {mode !== 'codigo' && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={undo}
            disabled={!canUndo}
            title="Desfazer"
          >
            <Undo2 className="size-4" /> <span className="hidden sm:inline">Desfazer</span>
          </Button>
        )}
      </div>

      {mode === 'codigo' ? (
        codeEditor
      ) : (
        <div
          // O Ctrl+Z desfaz no editor inteiro, não só no campo em que se está.
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
              e.preventDefault();
              undo();
            }
          }}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-xl border border-input bg-[var(--color-surface-container-lowest)]"
        >
          {showFields && <SongFields value={value} onChange={onChange} open={fieldsOpen} />}
          {mode === 'letra' ? (
            <LyricsMode doc={doc} commit={commit} replaceLine={replaceLine} />
          ) : (
            <ChordsMode doc={doc} replaceLine={replaceLine} songKey={key} />
          )}
          {mode === 'letra' && <AddLines doc={doc} commit={commit} />}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  mode,
  current,
  onSelect,
  icon: Icon,
  label,
}: {
  mode: EditorMode;
  current: EditorMode;
  onSelect: (mode: EditorMode) => void;
  icon: typeof Type;
  label: string;
}) {
  const active = mode === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(mode)}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-colors',
        active ? 'bg-navy-700 text-gold-300' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

/** Título, artista, tom: cada campo muda só a própria linha do arquivo. */
function SongFields({
  value,
  onChange,
  open,
}: {
  value: string;
  onChange: (next: string) => void;
  open: boolean;
}) {
  const field = (name: string, label: string, className = '') => (
    <label className={cn('flex min-w-0 flex-col gap-1 text-xs text-muted-foreground', className)}>
      {label}
      <Input
        value={getField(value, name)}
        onChange={(e) => onChange(setField(value, name, e.target.value))}
        className="h-9"
      />
    </label>
  );

  return (
    <details open={open} className="border-b border-border">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Dados da música
      </summary>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4">
        {field('title', 'Título', 'col-span-2')}
        {field('artist', 'Artista', 'col-span-2')}
        {field('key', 'Tom')}
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
          Capo
          <select
            value={getField(value, 'capo')}
            onChange={(e) => onChange(setField(value, 'capo', e.target.value))}
            className="h-9 w-full rounded-xl border border-input bg-[var(--color-surface-container-lowest)] px-2 text-sm text-foreground"
          >
            <option value="">Sem capo</option>
            {CAPO_FRETS.map((fret) => (
              <option key={fret} value={String(fret)}>
                {fret}ª casa
              </option>
            ))}
          </select>
        </label>
        {field('categories', 'Categorias (vírgula)', 'col-span-2')}
      </div>
    </details>
  );
}

/** A última linha vazia é só o fim do arquivo: não vira um campo a mais na tela. */
function visibleLines(doc: ChoDocument): readonly DocLine[] {
  const last = doc.lines[doc.lines.length - 1];
  return last?.kind === 'lyric' && last.text === '' && last.chords.length === 0
    ? doc.lines.slice(0, -1)
    : doc.lines;
}

function SectionRow({
  line,
  onRename,
  onRemove,
}: {
  line: SectionLine;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-1.5">
      <input
        value={sectionName(line)}
        onChange={(e) => onRename(e.target.value)}
        aria-label="Nome da parte da música"
        spellCheck={false}
        className="field-sizing-content min-w-16 max-w-full rounded-md bg-transparent px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-primary focus:bg-card focus:outline-1 focus:outline-gold-500"
      />
      <span aria-hidden className="rule-gold min-w-4 flex-1" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover o título ${sectionName(line)}`}
        title="Remove só o título; a letra fica"
        className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ==========================================================================
   Modo Letra
   ========================================================================== */

function LyricsMode({
  doc,
  commit,
  replaceLine,
}: {
  doc: ChoDocument;
  commit: (current: ChoDocument, next: ChoDocument, typingLineId?: number) => void;
  replaceLine: (line: DocLine, typing?: boolean) => void;
}) {
  /** Depois de Enter ou de juntar linhas, o cursor vai para o lugar certo. */
  const pendingFocus = useRef<{ id: number; caret: number } | null>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>());

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const input = inputs.current.get(pending.id);
    input?.focus();
    input?.setSelectionRange(pending.caret, pending.caret);
  });

  const lyricNeighbor = (index: number, step: -1 | 1): LyricLine | undefined => {
    for (let i = index + step; i >= 0 && i < doc.lines.length; i += step) {
      const line = doc.lines[i]!;
      if (line.kind === 'lyric' && !isChordOnly(line)) return line;
    }
    return undefined;
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, line: LyricLine, index: number) => {
    const caret = e.currentTarget.selectionStart ?? 0;
    const collapsed = caret === e.currentTarget.selectionEnd;

    if (e.key === 'Enter') {
      e.preventDefault();
      const [head, tail] = splitLine(line, caret);
      const lines = [...doc.lines];
      lines.splice(index, 1, head, tail);
      pendingFocus.current = { id: tail.id, caret: 0 };
      commit(doc, { ...doc, lines });
    } else if (e.key === 'Backspace' && caret === 0 && collapsed) {
      const previous = doc.lines[index - 1];
      if (previous?.kind !== 'lyric' || isChordOnly(previous)) return;
      e.preventDefault();
      const merged = mergeLines(previous, line);
      const lines = [...doc.lines];
      lines.splice(index - 1, 2, merged);
      pendingFocus.current = {
        id: merged.id,
        caret: merged.text.length - line.text.length,
      };
      commit(doc, { ...doc, lines });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const neighbor = lyricNeighbor(index, e.key === 'ArrowUp' ? -1 : 1);
      if (!neighbor) return;
      e.preventDefault();
      const input = inputs.current.get(neighbor.id);
      input?.focus();
      input?.setSelectionRange(caret, caret);
    }
  };

  /** Colar várias linhas cria várias linhas. Uma só segue o caminho normal. */
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>, line: LyricLine, index: number) => {
    const pasted = e.clipboardData.getData('text');
    if (!/\r?\n/.test(pasted)) return;
    e.preventDefault();

    const start = e.currentTarget.selectionStart ?? line.text.length;
    const end = e.currentTarget.selectionEnd ?? start;
    const [first = '', ...others] = pasted.split(/\r?\n/);
    const last = others.pop() ?? '';

    const before = editLyric(line, line.text.slice(0, start) + first + line.text.slice(end), start);
    const [head, tail] = splitLine(before, start + parseLyricLine(first).text.length);
    const middle = others.map((raw) => lyricLine(raw));
    const closing = editLyric(tail, last + tail.text, parseLyricLine(last).text.length);

    const lines = [...doc.lines];
    lines.splice(index, 1, head, ...middle, closing);
    pendingFocus.current = { id: closing.id, caret: parseLyricLine(last).text.length };
    commit(doc, { ...doc, lines });
  };

  const removeLine = (id: number) => {
    commit(doc, { ...doc, lines: doc.lines.filter((l) => l.id !== id) });
  };

  const shown = visibleLines(doc);

  return (
    <div className="flex flex-col gap-0.5 p-3">
      <p className="mb-1 text-xs text-muted-foreground">
        Digite a letra à vontade: os acordes acompanham a sílaba. Enter cria outra linha.
      </p>

      {shown.map((line, index) => {
        if (line.kind === 'section') {
          return (
            <SectionRow
              key={line.id}
              line={line}
              onRename={(name) => replaceLine({ ...line, text: `{${name}}` }, true)}
              onRemove={() => removeLine(line.id)}
            />
          );
        }
        if (line.kind === 'raw') {
          return (
            <input
              key={line.id}
              value={line.text}
              onChange={(e) => replaceLine({ ...line, text: e.target.value }, true)}
              aria-label="Comentário ou diretiva"
              spellCheck={false}
              className="w-full rounded-md bg-transparent px-1.5 py-0.5 font-mono text-xs italic text-muted-foreground focus:bg-card focus:outline-1 focus:outline-gold-500"
            />
          );
        }
        if (isChordOnly(line)) {
          return (
            <p
              key={line.id}
              className="px-1.5 font-mono text-sm font-semibold text-accent"
              title="Linha só de acordes: mude no modo Acordes"
            >
              {line.chords.map((c) => c.chord).join('  ')}
            </p>
          );
        }
        return (
          <LyricInput
            key={line.id}
            line={line}
            register={(el) => {
              if (el) inputs.current.set(line.id, el);
              else inputs.current.delete(line.id);
            }}
            onEdit={(raw, caret) => replaceLine(editLyric(line, raw, caret), true)}
            onKeyDown={(e) => handleKey(e, line, index)}
            onPaste={(e) => handlePaste(e, line, index)}
            onRemove={() => removeLine(line.id)}
          />
        );
      })}
    </div>
  );
}

function LyricInput({
  line,
  register,
  onEdit,
  onKeyDown,
  onPaste,
  onRemove,
}: {
  line: LyricLine;
  register: (el: HTMLInputElement | null) => void;
  onEdit: (raw: string, caret?: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const row = line.chords.length > 0 ? chordRow(line) : '';
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <div className="group flex items-end gap-1 font-mono text-sm leading-snug">
      <div className="min-w-0 flex-1 overflow-hidden">
        {row && (
          <div
            ref={rowRef}
            aria-hidden
            className="whitespace-pre px-1.5 font-semibold text-accent select-none"
          >
            {row}
          </div>
        )}
        <input
          ref={register}
          value={line.text}
          onChange={(e) => onEdit(e.target.value, e.target.selectionStart ?? undefined)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          // Campo com letra longa rola sozinho: os acordes rolam junto.
          onScroll={(e) => {
            if (rowRef.current) {
              rowRef.current.style.transform = `translateX(${-e.currentTarget.scrollLeft}px)`;
            }
          }}
          enterKeyHint="next"
          spellCheck
          aria-label={line.text ? `Linha: ${line.text}` : 'Linha vazia'}
          className="w-full rounded-md bg-transparent px-1.5 py-0.5 text-foreground outline-none hover:bg-[var(--color-surface-hover)] focus:bg-card focus:outline-1 focus:outline-gold-500"
        />
      </div>
      {/* No celular nem sempre o Backspace avisa: aqui dá para tirar a linha. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={line.text ? `Excluir a linha: ${line.text}` : 'Excluir a linha vazia'}
        title="Excluir a linha"
        className="mb-0.5 shrink-0 rounded-full p-1 text-muted-foreground/40 transition-colors hover:text-destructive group-focus-within:text-muted-foreground"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

/* ==========================================================================
   Modo Acordes
   ========================================================================== */

/** O que está aberto na barra: um acorde existente ou um lugar para um novo. */
type ChordTarget =
  | { readonly kind: 'existing'; readonly lineId: number; readonly index: number }
  | { readonly kind: 'new'; readonly lineId: number; readonly at: number };

function ChordsMode({
  doc,
  replaceLine,
  songKey,
}: {
  doc: ChoDocument;
  replaceLine: (line: DocLine, typing?: boolean) => void;
  songKey: string | undefined;
}) {
  const [target, setTarget] = useState<ChordTarget | null>(null);
  const [draft, setDraft] = useState('');

  const targetLine = target
    ? (doc.lines.find((l) => l.id === target.lineId) as LyricLine | undefined)
    : undefined;

  // Sugestões: primeiro o que a música já usa, depois o campo harmônico do tom.
  const suggestions = useMemo(() => {
    const field = songKey ? (HARMONIC_FIELDS[songKey] ?? []) : [];
    return [...new Set([...usedChords(doc), ...field])];
  }, [doc, songKey]);

  /** Tocar numa letra: move o acorde selecionado, ou abre um lugar para um novo. */
  const touchLetter = (line: LyricLine, at: number) => {
    if (target?.kind === 'existing' && target.lineId === line.id) {
      const moved = moveChord(line, target.index, at);
      replaceLine(moved.line);
      setTarget(null);
      return;
    }
    setDraft('');
    setTarget({ kind: 'new', lineId: line.id, at });
  };

  const touchChord = (line: LyricLine, index: number) => {
    setDraft(line.chords[index]?.chord ?? '');
    setTarget({ kind: 'existing', lineId: line.id, index });
  };

  /** Confirma o acorde. Um novo fecha a barra, para o próximo toque abrir outro. */
  const confirm = (chord: string) => {
    const value = chord.trim();
    if (!target || !targetLine) return;
    if (target.kind === 'new') {
      if (value) replaceLine(addChord(targetLine, target.at, value));
    } else if (value) {
      replaceLine(setChord(targetLine, target.index, value));
    }
    setTarget(null);
  };

  const nudge = (step: -1 | 1) => {
    if (!target || !targetLine) return;
    if (target.kind === 'new') {
      const at = Math.min(Math.max(target.at + step, 0), targetLine.text.length);
      setTarget({ ...target, at });
      return;
    }
    const moved = nudgeChord(targetLine, target.index, step);
    replaceLine(moved.line);
    setTarget({ ...target, index: moved.index });
  };

  // A barra cobre o fim da tela: traz para o meio a letra ou o acorde em questão.
  const linesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    linesRef.current
      ?.querySelector('[data-target="true"]')
      ?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [target]);

  const shown = visibleLines(doc);

  return (
    <>
      <div ref={linesRef} className="flex flex-1 flex-col gap-1 p-3">
        <p className="mb-1 text-xs text-muted-foreground">
          Toque numa letra para colocar um acorde. Toque num acorde para trocar, mover ou remover. A
          letra não muda aqui.
        </p>

        {shown.map((line) => {
          if (line.kind === 'section') {
            return (
              <p
                key={line.id}
                className="mt-3 px-1.5 text-xs font-bold uppercase tracking-wide text-primary"
              >
                {sectionName(line)}
              </p>
            );
          }
          if (line.kind === 'raw') {
            return (
              <p key={line.id} className="px-1.5 font-mono text-xs italic text-muted-foreground">
                {line.text}
              </p>
            );
          }
          return (
            <ChordLine
              key={line.id}
              line={line}
              target={target?.lineId === line.id ? target : null}
              onLetter={(at) => touchLetter(line, at)}
              onChord={(index) => touchChord(line, index)}
            />
          );
        })}
      </div>

      {target && targetLine && (
        <ChordBar
          isNew={target.kind === 'new'}
          draft={draft}
          onDraft={setDraft}
          suggestions={suggestions}
          onConfirm={confirm}
          onCancel={() => setTarget(null)}
          onNudge={nudge}
          onRemove={() => {
            if (target.kind === 'existing') {
              replaceLine(removeChord(targetLine, target.index));
            }
            setTarget(null);
          }}
        />
      )}
    </>
  );
}

function ChordLine({
  line,
  target,
  onLetter,
  onChord,
}: {
  line: LyricLine;
  target: ChordTarget | null;
  onLetter: (at: number) => void;
  onChord: (index: number) => void;
}) {
  // Um `onClick` só, na linha inteira: um botão por letra pesaria no celular.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const at = (e.target as HTMLElement).closest<HTMLElement>('[data-at]')?.dataset.at;
    if (at !== undefined) onLetter(Number(at));
  };

  const chordOnly = isChordOnly(line);
  const empty = line.text === '' && line.chords.length === 0;
  if (empty) return <div aria-hidden className="h-3" />;

  return (
    <div
      onClick={handleClick}
      className="flex flex-wrap items-end font-mono text-base leading-relaxed"
    >
      {lineSegments(line).map((segment) => {
        const selected = target?.kind === 'existing' && segment.chordIndex === target.index;
        const chord = segment.chordIndex !== null ? line.chords[segment.chordIndex] : undefined;
        const valid = chord ? parseChordString(chord.chord) !== null : true;

        return (
          <span key={`${segment.chordIndex}-${segment.start}`} className="inline-flex flex-col">
            <span className="min-h-[1.45em] pr-1">
              {chord && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (segment.chordIndex !== null) onChord(segment.chordIndex);
                  }}
                  aria-label={`Acorde ${chord.chord}`}
                  aria-pressed={selected}
                  data-target={selected}
                  title={valid ? undefined : 'O app não reconhece este acorde'}
                  className={cn(
                    'rounded px-0.5 font-semibold transition-colors',
                    selected
                      ? 'bg-navy-700 text-gold-300'
                      : 'text-accent hover:bg-[var(--color-surface-hover)]',
                    !valid && 'underline decoration-destructive decoration-wavy',
                  )}
                >
                  {chord.chord}
                </button>
              )}
            </span>
            {!chordOnly && (
              <span className="whitespace-pre-wrap">
                {Array.from(segment.text).map((char, i) => (
                  <Letter
                    key={i}
                    char={char}
                    at={segment.start + i}
                    marked={target?.kind === 'new' && target.at === segment.start + i}
                  />
                ))}
              </span>
            )}
          </span>
        );
      })}

      {/* Depois da última letra: lugar para o acorde do fim da linha. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onLetter(line.text.length);
        }}
        aria-label={chordOnly ? 'Acrescentar acorde' : 'Colocar acorde no fim da linha'}
        title="Acorde no fim da linha"
        className={cn(
          'ml-1 self-end rounded-full p-0.5 text-muted-foreground/50 transition-colors hover:text-accent',
          target?.kind === 'new' && target.at >= line.text.length && 'text-accent',
        )}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function Letter({ char, at, marked }: { char: string; at: number; marked: boolean }) {
  return (
    <span
      data-at={at}
      data-target={marked}
      className={cn(
        'cursor-pointer rounded-sm text-foreground hover:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)]',
        marked && 'bg-navy-700 text-gold-300',
      )}
    >
      {char}
    </span>
  );
}

/** A barra de escolher o acorde, presa embaixo: alcança o polegar no celular. */
function ChordBar({
  isNew,
  draft,
  onDraft,
  suggestions,
  onConfirm,
  onCancel,
  onNudge,
  onRemove,
}: {
  isNew: boolean;
  draft: string;
  onDraft: (value: string) => void;
  suggestions: readonly string[];
  onConfirm: (chord: string) => void;
  onCancel: () => void;
  onNudge: (step: -1 | 1) => void;
  onRemove: () => void;
}) {
  const invalid = draft.trim() !== '' && parseChordString(draft.trim()) === null;

  return (
    <div
      role="group"
      aria-label={isNew ? 'Novo acorde' : 'Editar acorde'}
      className="sticky bottom-0 z-10 flex min-w-0 flex-col gap-2 border-t border-border bg-card p-2.5 shadow-floating"
    >
      <div className="flex min-w-0 gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {suggestions.length === 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListMusic className="size-3.5" /> Defina o tom da música para ver sugestões.
          </span>
        )}
        {suggestions.map((chord) => (
          <button
            key={chord}
            type="button"
            onClick={() => onConfirm(chord)}
            className="shrink-0 rounded-full border border-gold-500/40 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 py-1 font-mono text-sm font-semibold text-accent transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
          >
            {chord}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onConfirm(draft);
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          placeholder={isNew ? 'Ou digite, ex.: Am7' : 'Acorde'}
          aria-label="Acorde"
          aria-invalid={invalid}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 font-mono"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNudge(-1)}
          aria-label="Mover para a esquerda"
          title="Mover para a esquerda"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNudge(1)}
          aria-label="Mover para a direita"
          title="Mover para a direita"
        >
          <ChevronRight className="size-4" />
        </Button>
        {!isNew && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label="Remover o acorde"
              title="Remover o acorde"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
        <Button size="sm" onClick={() => onConfirm(draft)}>
          {isNew && !draft.trim() ? 'Fechar' : 'OK'}
        </Button>
      </div>

      {invalid ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" /> O app não reconhece este acorde: ele não
          transpõe.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {isNew
            ? 'As setas ajustam a letra marcada, se o toque errou.'
            : 'Para mover para longe, toque na letra onde ele deve ficar.'}
        </p>
      )}
    </div>
  );
}

/** Acrescentar linhas e partes, em qualquer modo. */
function AddLines({
  doc,
  commit,
}: {
  doc: ChoDocument;
  commit: (current: ChoDocument, next: ChoDocument, typingLineId?: number) => void;
}) {
  /** Entra antes da última linha vazia, que é só o fim do arquivo. */
  const append = (...added: DocLine[]) => {
    const shown = visibleLines(doc);
    const trailing = doc.lines.slice(shown.length);
    commit(doc, { ...doc, lines: [...shown, ...added, ...trailing] });
  };

  return (
    <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border p-2.5">
      <Button variant="outline" size="sm" className="gap-1" onClick={() => append(lyricLine())}>
        <Plus className="size-3.5" /> Linha
      </Button>
      {NEW_SECTIONS.map(([label, name]) => (
        <Button
          key={name}
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => append(lyricLine(), sectionLine(name), lyricLine())}
        >
          <Plus className="size-3.5" /> {label}
        </Button>
      ))}
    </div>
  );
}
