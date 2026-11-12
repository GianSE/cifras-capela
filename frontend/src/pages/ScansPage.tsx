import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  FileText,
  Music,
  ImageUp,
  Loader2,
  ScanText,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionTitle } from '@/components/layout/SectionTitle';
import { EmptyState } from '@/components/library/EmptyState';
import { Button } from '@/components/ui/button';
import { ErrorDialog } from '@/components/ui/error-dialog';
import { useSongLibrary } from '@/hooks/useSongLibrary';
import { AddToPlaylist } from '@/components/playlist/AddToPlaylist';
import { UseScanAsSongDialog } from '@/components/scans/UseScanAsSongDialog';
import {
  SCAN_ACCEPT,
  deleteScan,
  deleteScanAndSong,
  deleteScanKeepingSong,
  isPdfScan,
  listScans,
  scanFileUrl,
  uploadScan,
  type Scan,
} from '@/lib/scans';

/** Envio em andamento (ou que falhou), mostrado no topo da fila. */
interface PendingUpload {
  readonly key: string;
  readonly name: string;
  readonly error?: string;
}

function formatDate(iso: string): string {
  // O D1 grava "AAAA-MM-DD HH:MM:SS" em UTC, sem o "Z".
  const date = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * `/folhas` — fotografe a folha na correria e transcreva depois.
 *
 * Tirar a foto só guarda o arquivo (nada de OCR na hora). A fila "Para
 * transcrever" mostra o que ainda não virou cifra; depois de confirmada, a
 * folha vai para "Validadas" e continua guardada como cópia do original.
 */
export function ScansPage() {
  const navigate = useNavigate();
  const { songs } = useSongLibrary();
  const [scans, setScans] = useState<Scan[] | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  /** Folha ganhando um nome, para virar música. */
  const [naming, setNaming] = useState<Scan | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listScans();
      setScans(data.scans);
      setAiAvailable(data.aiAvailable);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar as folhas.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const keyed = list.map((file, i) => ({ file, key: `${Date.now()}-${i}` }));
    setUploads((u) => [...keyed.map(({ file, key }) => ({ key, name: file.name })), ...u]);

    // Um de cada vez: no 4G, mandar várias fotos juntas deixa todas lentas.
    for (const { file, key } of keyed) {
      try {
        const scan = await uploadScan(file);
        setScans((s) => [scan, ...(s ?? [])]);
        setUploads((u) => u.filter((x) => x.key !== key));
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Falha no envio.';
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error } : x)));
      }
    }
  };

  const songOf = (scan: Scan) => songs.find((s) => s.id === scan.songId);

  const handleDelete = async (scan: Scan) => {
    const song = songOf(scan);
    // Sem texto, a foto é a música inteira: apagar uma apaga a outra, e é bom avisar.
    const message = !song
      ? 'Excluir esta folha? Ela ainda não foi transcrita.'
      : song.lyrics
        ? `Apagar a foto de "${song.title}"? A música continua na biblioteca, com o texto.`
        : `"${song.title}" só existe como esta foto. Excluir apaga a música também, inclusive das playlists.`;
    if (!confirm(message)) return;
    try {
      if (!song) await deleteScan(scan.id);
      else if (song.lyrics) await deleteScanKeepingSong(scan);
      else await deleteScanAndSong(scan);
      setScans((s) => (s ?? []).filter((x) => x.id !== scan.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não foi possível excluir.');
    }
  };

  // Quem digitou a cifra direto no Editor também já transcreveu.
  const isDone = (scan: Scan) => scan.status === 'validada' || Boolean(songOf(scan)?.lyrics);
  const pending = (scans ?? []).filter((s) => !isDone(s));
  const validated = (scans ?? []).filter(isDone);
  const songTitle = (id: string | null) => songs.find((s) => s.id === id)?.title;

  return (
    <>
      <PageHeader
        title="Folhas"
        icon={Camera}
        contentWidth="max-w-3xl"
        subtitle="Fotografe agora, transcreva com calma depois"
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:px-8">
        {/* Captura: os dois maiores alvos da tela, porque é feito com pressa. */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="card-lift flex flex-col items-center justify-center gap-2 rounded-2xl border border-gold-500/50 bg-card px-4 py-7 text-center hover:border-gold-500"
          >
            <span className="grid size-12 place-items-center rounded-full bg-navy-700 text-gold-300">
              <Camera className="size-6" />
            </span>
            <span className="font-display text-lg text-foreground">Tirar foto</span>
            <span className="text-xs text-muted-foreground">Abre a câmera</span>
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="card-lift flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-7 text-center hover:border-gold-400/60"
          >
            <span className="grid size-12 place-items-center rounded-full bg-navy-700 text-gold-300">
              <ImageUp className="size-6" />
            </span>
            <span className="font-display text-lg text-foreground">Enviar arquivo</span>
            <span className="text-xs text-muted-foreground">Foto da galeria ou PDF</span>
          </button>

          {/* `capture` abre direto a câmera traseira no celular; no PC vira seletor. */}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={fileInput}
            type="file"
            accept={SCAN_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <ErrorDialog message={loadError} onClose={() => setLoadError(null)} />

        {/* Para transcrever */}
        <section>
          <SectionTitle
            icon={ScanText}
            aside={scans ? `${pending.length} ${pending.length === 1 ? 'folha' : 'folhas'}` : ''}
          >
            Para transcrever
          </SectionTitle>

          {!aiAvailable && scans && pending.length > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">
              A IA não está configurada no servidor: a transcrição usa o reconhecimento do próprio
              aparelho, que erra mais a posição dos acordes.
            </p>
          )}

          {uploads.length > 0 && (
            <ul className="mb-2.5 flex flex-col gap-2">
              {uploads.map((u) => (
                <li
                  key={u.key}
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-3 text-sm"
                >
                  {u.error ? (
                    <span className="text-destructive">
                      {u.name}: {u.error}
                    </span>
                  ) : (
                    <>
                      <Loader2 className="size-4 animate-spin text-gold-600 dark:text-gold-400" />
                      <span className="truncate text-muted-foreground">Enviando {u.name}…</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {scans === null && !loadError ? (
            <div className="space-y-2.5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : pending.length === 0 && uploads.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="Nenhuma folha esperando"
              description="Tire uma foto da cifra no ensaio — ela fica guardada aqui até você transcrever."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {pending.map((scan) => (
                <ScanCard
                  key={scan.id}
                  scan={scan}
                  title={songTitle(scan.songId)}
                  onDelete={() => void handleDelete(scan)}
                >
                  {songOf(scan) ? (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/musica/${scan.songId}`}>Abrir</Link>
                      </Button>
                      <AddToPlaylist songId={scan.songId!} variant="button" />
                    </>
                  ) : (
                    <Button
                      variant="gold"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setNaming(scan)}
                    >
                      <Music className="size-4" /> Usar como música
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate(`/importar?folha=${encodeURIComponent(scan.id)}`)}
                  >
                    {aiAvailable ? (
                      <Sparkles className="size-4" />
                    ) : (
                      <ScanText className="size-4" />
                    )}
                    Transcrever
                  </Button>
                </ScanCard>
              ))}
            </ul>
          )}
        </section>

        {/* Validadas: o backup do original, ligado à música */}
        {validated.length > 0 && (
          <section>
            <SectionTitle icon={CheckCircle2} aside={`${validated.length}`}>
              Validadas
            </SectionTitle>
            <ul className="flex flex-col gap-2.5">
              {validated.map((scan) => (
                <ScanCard
                  key={scan.id}
                  scan={scan}
                  title={songTitle(scan.songId)}
                  onDelete={() => void handleDelete(scan)}
                >
                  {scan.songId && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/musica/${scan.songId}`}>Abrir música</Link>
                    </Button>
                  )}
                </ScanCard>
              ))}
            </ul>
          </section>
        )}
      </div>

      <UseScanAsSongDialog
        scan={naming}
        songs={songs}
        onClose={() => setNaming(null)}
        onCreated={(songId) => {
          const id = naming?.id;
          setScans((list) => (list ?? []).map((s) => (s.id === id ? { ...s, songId } : s)));
          setNaming(null);
        }}
      />
    </>
  );
}

function ScanCard({
  scan,
  title,
  onDelete,
  children,
}: {
  scan: Scan;
  /** Título da música (validadas); senão, o nome do arquivo. */
  title?: string;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-soft">
      {/* Miniatura: toca para ver o original inteiro em outra aba. */}
      <a
        href={scanFileUrl(scan.id)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Ver original de ${title ?? scan.filename}`}
        className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted"
      >
        {isPdfScan(scan) ? (
          <FileText className="size-7 text-muted-foreground" />
        ) : (
          <img
            src={scanFileUrl(scan.id)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        )}
      </a>

      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-base text-foreground">{title ?? scan.filename}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {formatDate(scan.createdAt)} · {isPdfScan(scan) ? 'PDF' : 'Foto'}
          <a
            href={scanFileUrl(scan.id)}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-0.5 hover:text-foreground"
          >
            original <ExternalLink className="size-3" />
          </a>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">{children}</div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">{children}</div>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Excluir ${scan.filename}`}
        className="shrink-0 self-start rounded-full p-2 text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
