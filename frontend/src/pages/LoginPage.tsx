import { useNavigate, useLocation } from 'react-router';
import { SignInForm } from '@/components/auth/SignInForm';

/**
 * Entrada do site, em `/`. Aparece quando ninguém entrou (o guard redireciona
 * para cá) e também é para onde o logout leva. O acervo é fechado: só entra
 * quem tem conta, criada por um administrador em Mais › Usuários.
 *
 * É a porta de entrada, então veste a marca inteira: fundo no azul do manto,
 * selo dourado e o cartão em marfim.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Volta para a página de origem (se veio de um redirecionamento) ou à biblioteca.
  const from = (location.state as { from?: string } | null)?.from ?? '/home';
  const goToApp = () => navigate(from, { replace: true });

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
          {/* A marca de verdade, grande: é a porta de entrada. O 192px basta
              (12 KB) e o fundo branco da arte vira o disco. */}
          <img
            src="/icons/icon-192.jpg"
            alt=""
            width={88}
            height={88}
            className="mb-4 size-22 rounded-full bg-white object-cover shadow-gilded ring-1 ring-gold-400/40"
          />
          <p className="eyebrow text-gold-400">Capela N. S. de Fátima</p>
          <h1 className="font-display mt-1 text-4xl text-ivory">Biblioteca de Cifras</h1>
          <p className="mt-2 text-sm text-navy-100/80">
            Entre com a conta que o responsável pela música criou para você.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/15 bg-card shadow-floating">
          <div aria-hidden className="h-[3px] bg-[image:var(--gradient-gold)]" />
          <div className="p-6">
            <h2 className="font-display mb-4 text-xl text-foreground">Entrar</h2>
            <SignInForm onSignedIn={goToApp} />
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-navy-200">
          Sem conta? Peça a quem cuida da biblioteca.
        </p>
      </div>
    </div>
  );
}
