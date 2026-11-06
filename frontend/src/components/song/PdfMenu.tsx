import type { ReactNode } from 'react';
import { FileText, Music } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PdfMenuProps {
  /** O botão que abre o menu. */
  trigger: ReactNode;
  onExport: (lyricsOnly: boolean) => void;
}

/** Escolha do PDF: com os acordes, para quem toca, ou só a letra, para quem canta. */
export function PdfMenu({ trigger, onExport }: PdfMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => onExport(false)}>
          <Music /> Com as cifras, para quem toca
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport(true)}>
          <FileText /> Só a letra, para quem canta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
