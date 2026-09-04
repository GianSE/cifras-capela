import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useEditAccess } from '@/hooks/useEditAccess';
import { SignInForm } from './SignInForm';

/**
 * Gate das páginas de escrita (Importar, Editor).
 *
 * Quando ninguém entrou, mostra um aviso claro com o
 * login inline — em vez de deixar a pessoa mexer numa página que só vai falhar
 * ao salvar. Já logado, renderiza o conteúdo normalmente.
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
  const { needsLogin, isLoading } = useEditAccess();

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
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
