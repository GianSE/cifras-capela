import { useMemo } from 'react';
import { ListTree } from 'lucide-react';
import type { Song } from '@/types/song';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SectionJumpProps {
  song: Song;
  /** O mesmo prefixo passado ao `SongRenderer` desta tela. */
  idPrefix: string;
  className?: string;
}

/**
 * Salta direto para uma seção da cifra (refrão, ponte, verso).
 *
 * Numa música longa — ou quando o grupo repete o refrão fora de ordem —
 * procurar rolando no meio do louvor é o que mais atrapalha.
 */
export function SectionJump({ song, idPrefix, className }: SectionJumpProps) {
  /** Só as seções nomeadas: as sem rótulo não dão o que mostrar no menu. */
  const targets = useMemo(
    () =>
      song.sections
        .map((section, index) => ({ label: section.label, id: `${idPrefix}-${index}` }))
        .filter((s): s is { label: string; id: string } => Boolean(s.label)),
    [song, idPrefix],
  );

  // Com uma seção só (ou nenhuma), o menu não levaria a lugar nenhum.
  if (targets.length < 2) return null;

  const jumpTo = (id: string) => {
    // `scrollIntoView` acha sozinho o contêiner rolável — que é o do leitor
    // ou o do palco, conforme quem estiver aberto.
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Ir para uma seção"
          title="Ir para uma seção"
          className={className}
        >
          <ListTree />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="max-h-72 overflow-y-auto">
        {targets.map(({ label, id }) => (
          <DropdownMenuItem key={id} onSelect={() => jumpTo(id)} className="capitalize">
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
