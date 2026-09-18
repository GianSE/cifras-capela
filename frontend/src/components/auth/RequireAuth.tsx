import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Eye, Lock } from 'lucide-react';
import { useEditAccess } from '@/hooks/useEditAccess';
import { Button } from '@/components/ui/button';
import { SignInForm } from './SignInForm';

/**
 * Gate das páginas de escrita (Importar, Editor).
 *
 * Quando ninguém entrou, mostra o login inline; quando a conta é só de
 * leitura, explica que essa parte é de administrador — em vez de deixar mexer
 * numa página que só vai falhar ao salvar.
 */
export function RequireAuth({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { needsLogin, isReader, isLoading } = useEditAccess();

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  if (isReader) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div aria-hidden className="h-[3px] bg-[image:var(--gradient-gold)]" />
          <div className="p-6">
            <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-navy-700 text-gold-300">
              <Eye className="size-5" />
            </div>
            <h1 className="font-display text-2xl text-foreground">Sua conta é só de leitura</h1>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Esta parte é de quem administra a biblioteca. Você continua podendo abrir as
              músicas, transpor e montar playlists.
            </p>
            <Button asChild variant="secondary">
              <Link to="/home">Voltar à biblioteca</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div aria-hidden className="h-[3px] bg-[image:var(--gradient-gold)]" />
          <div className="p-6">
            <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-navy-700 text-gold-300">
              <Lock className="size-5" />
            </div>
            <h1 className="font-display text-2xl text-foreground">{title}</h1>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">{description}</p>
            <SignInForm />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
