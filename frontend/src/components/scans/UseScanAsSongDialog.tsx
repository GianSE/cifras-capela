import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DuplicateWarning } from '@/components/library/DuplicateWarning';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createSongFromScan, type Scan } from '@/lib/scans';
import type { SongIndexEntry } from '@/types/library';

/**
 * Dar nome à folha para usá-la já, sem transcrever: ela entra na biblioteca e nas
 * playlists como qualquer música, e o leitor mostra a foto. Só o nome é obrigatório.
 */
export function UseScanAsSongDialog({
  scan,
  songs,
  initial,
  onClose,
  onCreated,
}: {
  /** O que já se sabe: o nome digitado na busca, a parte da missa. */
  initial?: { readonly title?: string; readonly categories?: string };
  scan: Scan | null;
  songs: readonly SongIndexEntry[];
  onClose: () => void;
  onCreated: (songId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [songKey, setSongKey] = useState('');
  const [categories, setCategories] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scan) return;
    setTitle(initial?.title ?? '');
    setArtist('');
    setSongKey('');
    setCategories(initial?.categories ?? '');
    setError(null);
    // Só ao abrir: depois disso, o que vale é o que a pessoa digita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan]);

  const submit = async () => {
    if (!scan || !title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const songId = await createSongFromScan(
        scan,
        {
          title: title.trim(),
          artist: artist.trim(),
          key: songKey.trim(),
          categories: categories
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        },
        songs.map((s) => s.id),
      );
      onCreated(songId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar a música.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={scan !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usar como música</DialogTitle>
          <DialogDescription>
            A foto já fica na biblioteca e nas playlists. Dá para transcrever depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="scan-song-title">Nome da música</Label>
          <Input
            id="scan-song-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
        </div>

        <DuplicateWarning title={title} songs={songs} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="scan-song-artist">Artista</Label>
            <Input
              id="scan-song-artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scan-song-key">Tom</Label>
            <Input
              id="scan-song-key"
              value={songKey}
              onChange={(e) => setSongKey(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="scan-song-categories">Categorias (vírgula)</Label>
            <Input
              id="scan-song-categories"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              placeholder="Ex.: Comunhão"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={() => void submit()}
            disabled={!title.trim() || saving}
            className="gap-1.5"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Criar música
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
