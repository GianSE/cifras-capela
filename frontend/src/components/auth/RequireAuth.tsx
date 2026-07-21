import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useEditAccess } from '@/hooks/useEditAccess';
import { SignInForm } from './SignInForm';

/**
 * Gate das páginas de escrita (Importar, Editor).
 *
 * Quando o Supabase está ligado e ninguém entrou, mostra um aviso claro com o
 * login inline — em vez de deixar a pessoa mexer numa página que só vai falhar
 * ao salvar. Sem Supabase (ou já logado), renderiza o conteúdo normalmente.
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
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">{description}</p>
          <SignInForm />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
