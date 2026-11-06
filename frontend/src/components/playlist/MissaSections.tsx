import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ListPlus, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { playlistStorage } from '@/lib/storage/playlists';
import { EXTRA_MISSA_SECTIONS } from '@/lib/missa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Playlist, PlaylistSection } from '@/types/playlist';

interface MissaSectionsProps {
  playlist: Playlist;
  /** Dono da missa: pode escolher músicas e mexer nas partes. */
  editable: boolean;
  /** Desenha as músicas de uma parte (cards reordenáveis ou só leitura). */
  renderSongs: (section: PlaylistSection) => ReactNode;
  /** Abre o seletor de músicas já apontando para esta parte. */
  onAddSong?: (section: PlaylistSection) => void;
  /** Conteúdo extra no fim de uma parte (as sugestões do dia). */
  renderExtra?: (section: PlaylistSection) => ReactNode;
}

/**
 * A missa, parte por parte: cada parte é um bloco com o nome em destaque e as
 * músicas escolhidas para ela. Parte vazia fica à vista ("Escolher música"),
 * para nada ser esquecido na hora de montar o repertório.
 */
export function MissaSections({
  playlist,
  editable,
  renderSongs,
  onAddSong,
  renderExtra,
}: MissaSectionsProps) {
  const sections = playlist.sections ?? [];

  const [renaming, setRenaming] = useState<PlaylistSection | null>(null);
  const [draftName, setDraftName] = useState('');
  /** Parte nova: `after` = id da parte que vem antes dela. */
  const [creating, setCreating] = useState<{ after: string } | null>(null);
  const [newName, setNewName] = useState('');

  const startRename = (section: PlaylistSection) => {
    setDraftName(section.name);
    setRenaming(section);
  };

  const saveRename = () => {
    if (renaming) playlistStorage.renameSection(playlist.id, renaming.id, draftName);
    setRenaming(null);
  };

  /**
   * Por padrão a parte nova entra antes do "Final" — é onde quase sempre
   * cabem as extras (Pós-comunhão, Ação de graças…).
   */
  const startCreate = (after?: string) => {
    const last = sections[sections.length - 1];
    const beforeLast = sections[sections.length - 2];
    const fallback =
      last && /final/i.test(last.name) && beforeLast ? beforeLast.id : (last?.id ?? '');
    setNewName('');
    setCreating({ after: after ?? fallback });
  };

  const saveCreate = (name = newName) => {
    if (!creating || !name.trim()) return;
    // '' = "no começo" no seletor.
    playlistStorage.addSection(playlist.id, name, creating.after || null);
    setCreating(null);
  };

  const removeSection = (section: PlaylistSection) => {
    const message =
      section.songIds.length > 0
        ? `Excluir a parte "${section.name}"? As músicas dela saem da missa.`
        : `Excluir a parte "${section.name}"?`;
    if (confirm(message)) playlistStorage.removeSection(playlist.id, section.id);
  };

  const usedNames = new Set(sections.map((s) => s.name.toLowerCase()));
  const suggestions = EXTRA_MISSA_SECTIONS.filter((n) => !usedNames.has(n.toLowerCase()));

  return (
    <>
      <div className="flex flex-col gap-6">
        {sections.map((section, index) => (
          <section key={section.id} aria-label={section.name}>
            <div className="mb-2.5 flex items-center gap-3">
              <h2 className="font-display shrink-0 text-lg text-foreground">{section.name}</h2>
              <span aria-hidden className="rule-gold min-w-4 flex-1" />
              {section.songIds.length > 1 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {section.songIds.length} músicas
                </span>
              )}

              {editable && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Opções da parte ${section.name}`}
                      className="-my-1 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-[var(--color-surface-hover)] hover:text-foreground"
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => startRename(section)}>
                      <Pencil /> Renomear parte
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => startCreate(section.id)}>
                      <ListPlus /> Nova parte depois desta
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={index === 0}
                      onSelect={() => playlistStorage.moveSection(playlist.id, section.id, -1)}
                    >
                      <ArrowUp /> Subir
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index === sections.length - 1}
                      onSelect={() => playlistStorage.moveSection(playlist.id, section.id, 1)}
                    >
                      <ArrowDown /> Descer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => removeSection(section)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 /> Excluir parte
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {section.songIds.length > 0 ? (
              <>
                {renderSongs(section)}
                {/* Duas músicas na mesma parte: vão tocar as duas, ou ainda estão
                    decidindo entre elas. À vista, para não parecer que só cabe uma. */}
                {editable && (
                  <button
                    type="button"
                    onClick={() => onAddSong?.(section)}
                    className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-outline)] p-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-gold-400/70 hover:text-accent"
                  >
                    <Plus className="size-4" /> Outra música em {section.name}
                  </button>
                )}
              </>
            ) : editable ? (
              <button
                type="button"
                onClick={() => onAddSong?.(section)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-outline)] p-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-gold-400/70 hover:text-accent"
              >
                <Plus className="size-4" /> Escolher música
              </button>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-3.5 text-center text-sm text-muted-foreground">
                Sem música
              </p>
            )}
            {renderExtra?.(section) && <div className="mt-2">{renderExtra(section)}</div>}
          </section>
        ))}
      </div>

      {editable && (
        <Button variant="outline" className="mt-6 w-full gap-2" onClick={() => startCreate()}>
          <ListPlus className="size-4" /> Adicionar parte
        </Button>
      )}

      {/* Renomear parte */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear parte</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button onClick={saveRename} disabled={!draftName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova parte */}
      <Dialog open={creating !== null} onOpenChange={(open) => !open && setCreating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova parte da missa</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="missa-section-name">Nome</Label>
            <Input
              id="missa-section-name"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCreate()}
              placeholder="Ex.: Pós-comunhão"
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setNewName(name)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-gold-400/70 hover:text-foreground"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {sections.length > 0 && creating && (
            <div className="space-y-2">
              <Label htmlFor="missa-section-after">Entra depois de</Label>
              <select
                id="missa-section-after"
                value={creating.after}
                onChange={(e) => setCreating({ after: e.target.value })}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">(no começo da missa)</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button onClick={() => saveCreate()} disabled={!newName.trim()}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
