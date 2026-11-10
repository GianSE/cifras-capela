import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Download, Plus, Upload } from 'lucide-react';
import { MIN_SITE_QUERY, SEARCH_DEBOUNCE_MS, SiteResults } from '@/components/import/CifraSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { usePlaylists } from '@/hooks/usePlaylists';
import { normalizeText } from '@/lib/library/duplicates';
import { songsForPart } from '@/lib/missa';
import type { PageHint } from '@/lib/import/url-importer';
import type { SongIndexEntry } from '@/types/library';
import type { Playlist, PlaylistSection } from '@/types/playlist';

const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/**
 * Escolher a música sem sair da playlist: o que já foi usado nesta parte vem
 * primeiro, depois a biblioteca. Quem pode importar resolve aqui mesmo o que ainda
 * não tem: um campo só aceita o nome ou o link; foto e arquivo passam pela
 * página de importar, que já sabe fazer isso.
 */
export function SongPicker({
  playlist,
  section,
  open,
  songs,
  onPick,
  onClose,
}: {
  playlist: Playlist;
  /** A parte da missa que vai receber a música. Numa playlist comum, não há. */
  section?: PlaylistSection | undefined;
  open: boolean;
  songs: readonly SongIndexEntry[];
  onPick: (songId: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const playlists = usePlaylists();

  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setText('');
    setQuery('');
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const linked = isLink(text);

  const { forPart, others } = useMemo(() => {
    const inPlaylist = new Set(playlist.songIds);
    const available = songs.filter((s) => !inPlaylist.has(s.id));
    const tokens = linked ? [] : normalizeText(text).split(' ').filter(Boolean);
    const matches = (song: SongIndexEntry) => {
      const name = ` ${normalizeText(`${song.title} ${song.artist ?? ''}`)}`;
      return tokens.every((token) => name.includes(` ${token}`));
    };

    const part = section ? songsForPart(available, playlists, section.name, playlist.id) : [];
    const partIds = new Set(part.map((s) => s.id));
    return {
      forPart: part.filter(matches),
      others: available
        .filter((s) => !partIds.has(s.id) && matches(s))
        .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
    };
  }, [songs, playlist, playlists, section, text, linked]);

  /** A revisão de sempre, levando para onde a música vai depois de salva. */
  const bring = (url: string, hint?: PageHint) => {
    const params = new URLSearchParams({
      url: url.trim(),
      missa: playlist.id,
      ...(section && { parte: section.id }),
      ...(hint?.title && { titulo: hint.title }),
      ...(hint?.artist && { artista: hint.artist }),
    });
    navigate(`/importar?${params}`);
  };

  /** Importar de um arquivo ou foto: a página de importar já sabe fazer isso. */
  const importElsewhere = () => {
    const params = new URLSearchParams({
      missa: playlist.id,
      ...(section && { parte: section.id }),
    });
    navigate(`/importar?${params}`);
  };

  const row = (song: SongIndexEntry) => (
    <li key={song.id}>
      <button
        type="button"
        onClick={() => onPick(song.id)}
        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        <Plus className="size-4 shrink-0 text-gold-600 dark:text-gold-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{song.title}</span>
          {song.artist && (
            <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
          )}
        </span>
        {song.key && (
          <span className="shrink-0 font-mono text-xs font-semibold text-accent">{song.key}</span>
        )}
      </button>
    </li>
  );

  const libraryCount = forPart.length + others.length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{section ? `Música para ${section.name}` : 'Adicionar músicas'}</DialogTitle>
        </DialogHeader>

        <Input
          autoFocus
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isAdmin ? 'Nome da música ou link da cifra' : 'Buscar por título ou artista…'
          }
          aria-label="Procurar música"
        />

        <div className="-mx-1 flex max-h-[55vh] flex-col gap-3 overflow-y-auto px-1">
          {isAdmin && linked && (
            <Button className="gap-2" onClick={() => bring(text)}>
              <Download className="size-4" /> Trazer desta página
            </Button>
          )}

          {forPart.length > 0 && (
            <section aria-label={`Já usadas em ${section?.name}`}>
              <h3 className="px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Para {section?.name}
              </h3>
              <ul>{forPart.map(row)}</ul>
            </section>
          )}

          {others.length > 0 && (
            <section aria-label="Na biblioteca">
              {forPart.length > 0 && (
                <h3 className="px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Na biblioteca
                </h3>
              )}
              <ul>{others.map(row)}</ul>
            </section>
          )}

          {!isAdmin && libraryCount === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma música disponível.
            </p>
          )}

          {isAdmin && !linked && (
            <>
              <SiteResults
                query={query}
                songs={songs}
                onImport={bring}
                otherResults={libraryCount}
              />

              {query.length < MIN_SITE_QUERY && libraryCount === 0 && (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Nada na biblioteca ainda.
                </p>
              )}
            </>
          )}
        </div>

        {isAdmin && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Não tem? Digite o nome para procurar nos sites, cole o link ou importe de um
              arquivo ou foto{section && `: ela já entra em ${section.name}`}.
            </p>
            <Button variant="outline" className="w-full gap-2" onClick={importElsewhere}>
              <Upload className="size-4" /> Importar música
            </Button>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Concluir</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
