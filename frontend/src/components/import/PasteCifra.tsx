import { useState } from 'react';
import { ClipboardPaste, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * Quando o site não deixa o app ler a página: abrir a música no site, copiar a
 * cifra e colar aqui. É o mesmo texto que o app buscaria, só que pela mão de quem
 * está vendo a página.
 */
export function PasteCifra({
  url,
  siteName,
  onPaste,
}: {
  url: string;
  siteName: string;
  onPaste: (text: string) => void;
}) {
  const [text, setText] = useState('');

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-soft">
      <div>
        <p className="font-display text-lg text-foreground">Copie a cifra no site e cole aqui</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">
          <li>Abra a música no {siteName}.</li>
          <li>Selecione a cifra, do título ao último acorde, e copie.</li>
          <li>Cole no campo abaixo.</li>
        </ol>
      </div>

      <Button asChild variant="outline" className="gap-2 self-start">
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" /> Abrir no {siteName}
        </a>
      </Button>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Cole a cifra aqui, com os acordes em cima da letra"
        aria-label="Cifra copiada do site"
        className="font-mono text-sm"
      />

      <Button onClick={() => onPaste(text)} disabled={!text.trim()} className="gap-2 self-end">
        <ClipboardPaste className="size-4" /> Usar este texto
      </Button>
    </div>
  );
}
