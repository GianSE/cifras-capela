import { useNavigate, useLocation } from 'react-router';
import { Music } from 'lucide-react';
import { SignInForm } from '@/components/auth/SignInForm';
import { Button } from '@/components/ui/button';
import { useGuestMode } from '@/hooks/useGuestMode';

/**
 * Página `/login`. Aparece quando o Supabase está ligado e ninguém entrou (o
 * guard redireciona para cá) e também é para onde o logout leva. Oferece o
 * login (criar/editar) ou seguir como convidado (só ver).
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { enterAsGuest } = useGuestMode();

  // Volta para a página de origem (se veio de um redirecionamento) ou à raiz.
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const goToApp = () => navigate(from, { replace: true });

  const handleGuest = () => {
    enterAsGuest();
    goToApp();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Music className="size-7" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Minha Biblioteca de Cifras
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre para criar e editar músicas, ou continue como convidado para só visualizar.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Entrar</h2>
          <SignInForm onSignedIn={goToApp} />
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={handleGuest}>
          Continuar como convidado
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Você pode entrar depois em Configurações › Conta.
        </p>
      </div>
    </div>
  );
}
