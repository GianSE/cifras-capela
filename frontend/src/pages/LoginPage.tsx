import { useNavigate, useLocation } from 'react-router';
import { Music } from 'lucide-react';
import { SignInForm } from '@/components/auth/SignInForm';
import { Button } from '@/components/ui/button';
import { useGuestMode } from '@/hooks/useGuestMode';

/**
 * Página `/login`. Aparece quando o Supabase está ligado e ninguém entrou (o
 * guard redireciona para cá) e também é para onde o logout leva. Oferece o
 * login (criar/editar) ou seguir como convidado (só ver).
 *
 * É a porta de entrada, então veste a marca inteira: fundo no azul do manto,
 * selo dourado e o cartão em marfim.
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
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[image:var(--gradient-blue)] px-4 py-12">
      {/* Raios dourados difusos, como os do manto. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 -z-10 size-96 rounded-full bg-gold-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 -z-10 size-96 rounded-full bg-navy-500/25 blur-3xl"
      />

      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-[image:var(--gradient-gold)] text-navy-900 shadow-gilded">
            <Music className="size-8" />
          </span>
          <p className="eyebrow text-gold-400">Capela N. S. de Fátima</p>
          <h1 className="font-display mt-1 text-4xl text-ivory">Biblioteca de Cifras</h1>
          <p className="mt-2 text-sm text-navy-100/80">
            Entre para criar e editar músicas, ou continue como convidado para só visualizar.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/15 bg-card shadow-floating">
          <div aria-hidden className="h-[3px] bg-[image:var(--gradient-gold)]" />
          <div className="p-6">
            <h2 className="font-display mb-4 text-xl text-foreground">Entrar</h2>
            <SignInForm onSignedIn={goToApp} />
          </div>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-navy-200">
          <span className="h-px flex-1 bg-white/20" /> ou{' '}
          <span className="h-px flex-1 bg-white/20" />
        </div>

        <Button variant="outline-dark" className="w-full" onClick={handleGuest}>
          Continuar como convidado
        </Button>
        <p className="mt-4 text-center text-xs text-navy-200">
          Você pode entrar depois em Configurações › Conta.
        </p>
      </div>
    </div>
  );
}
