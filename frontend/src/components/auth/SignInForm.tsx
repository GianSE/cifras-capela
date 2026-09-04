import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Guarda o último e-mail usado, para prefiller o login (menos digitação). */
const LAST_EMAIL_KEY = 'cifras-capela:last-email';

function readLastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Formulário de login (e-mail + senha). Quem autoriza a escrita é o Worker:
 * a sessão vira um JWT num cookie httpOnly, e as rotas de criar/editar só
 * aceitam quem o apresenta. Reutilizado nas Configurações e na Importação.
 *
 * O cookie dura 30 dias, então normalmente o login é uma vez só.
 */
export function SignInForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(readLastEmail);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setStatus('sending');
    setMessage('');
    try {
      await signIn(email.trim(), password);
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email.trim());
      } catch {
        /* localStorage indisponível */
      }
      setPassword('');
      setStatus('idle');
      onSignedIn?.();
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Não foi possível entrar.');
    }
  };

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSignIn();
      }}
    >
      <Input
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
      />
      <div className="flex gap-2">
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
        />
        <Button
          type="submit"
          variant="gold"
          disabled={status === 'sending' || !email.trim() || !password}
          className="shrink-0 gap-1.5"
        >
          <LogIn className="size-4" /> {status === 'sending' ? 'Entrando…' : 'Entrar'}
        </Button>
      </div>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </form>
  );
}
