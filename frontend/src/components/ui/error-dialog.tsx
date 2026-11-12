import { AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';

/**
 * Erro como modal, não como faixa no topo da página — no celular, uma faixa
 * lá em cima some da vista assim que a tela rola; o modal fica na frente até
 * a pessoa ler e fechar (ou tocar fora, que fecha também).
 */
export function ErrorDialog({
  message,
  onClose,
  title = 'Algo deu errado',
}: {
  /** `null`/vazio mantém o diálogo fechado. */
  message: string | null;
  onClose: () => void;
  title?: string;
}) {
  return (
    <Dialog open={Boolean(message)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" /> {title}
          </DialogTitle>
        </DialogHeader>
        <p role="alert" className="text-sm text-foreground">
          {message}
        </p>
        <Button onClick={onClose} className="self-end">
          Fechar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
