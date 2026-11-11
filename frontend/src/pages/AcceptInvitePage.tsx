import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptInvite, peekInvite, type InviteInfo } from '@/lib/invites-api';

const MIN_PASSWORD = 8;

type State =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'ready'; info: InviteInfo };

/**
 * `/convite/:token` — link de uso único, gerado por um administrador em
 * Usuários. Mesmo visual de entrada do site, mas aqui a pessoa escolhe a
 * própria senha: o administrador nunca chega a vê-la.
 *
 * Serve dois casos, diferenciados pelo que o Worker devolve (`kind`):
 *  - `convite`: cria a conta, com o e-mail/nome/papel que o administrador já
 *    definiu.
 *  - `redefinir`: troca a senha de uma conta que já existe.
 */
export function AcceptInvitePage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    peekInvite(token)
      .then((info) => active && setState({ status: 'ready', info }))
      .catch(() => active && setState({ status: 'invalid' }));
    return () => {
      active = false;
    };
  }, [token]);

  const senhaCurta = password !== '' && password.length < MIN_PASSWORD;
  const senhasDiferentes = confirm !== '' && password !== confirm;
  const podeEnviar = password.length >= MIN_PASSWORD && password === confirm;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await acceptInvite(token, password);
      setDone(true);
      // Recarrega para a sessão (cookie novo) ser lida do zero pelo app.
      window.location.href = '/playlists';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
      setSaving(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[image:var(--gradient-blue)] px-4 py-12">
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
          <img
            src="/icons/icon-192.jpg"
            alt=""
            width={88}
            height={88}
            className="mb-4 size-22 rounded-full bg-white object-cover shadow-gilded ring-1 ring-gold-400/40"
          />
          <p className="eyebrow text-gold-400">Capela N. S. de Fátima</p>
          <h1 className="font-display mt-1 text-4xl text-ivory">Biblioteca de Cifras</h1>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/15 bg-card shadow-floating">
          <div aria-hidden className="h-[3px] bg-[image:var(--gradient-gold)]" />
          <div className="p-6">
            {state.status === 'loading' && (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Conferindo o link…
              </p>
            )}

            {state.status === 'invalid' && (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <h2 className="font-display text-xl text-foreground">Link inválido</h2>
                <p className="text-sm text-muted-foreground">
                  Esse link não é mais válido — já foi usado, ou passou da validade. Peça um novo
                  para quem administra a biblioteca.
                </p>
              </div>
            )}

            {state.status === 'ready' && (
              <>
                <h2 className="font-display mb-1 text-xl text-foreground">
                  {state.info.kind === 'convite'
                    ? `Bem-vindo(a), ${state.info.name || 'você'}!`
                    : `Olá, ${state.info.name || 'você'}`}
                </h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  {state.info.kind === 'convite'
                    ? `Escolha a senha da sua conta (${state.info.email}) para entrar.`
                    : `Escolha a nova senha da sua conta (${state.info.email}).`}
                </p>

                <div className="flex flex-col gap-3">
                  <div>
                    <Label htmlFor="invite-password" className="mb-1.5 block text-sm">
                      Senha
                    </Label>
                    <Input
                      id="invite-password"
                      type="password"
                      autoComplete="new-password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={`Pelo menos ${MIN_PASSWORD} caracteres`}
                      aria-invalid={senhaCurta}
                    />
                    {senhaCurta && (
                      <p className="mt-1 text-xs text-destructive">
                        A senha precisa de pelo menos {MIN_PASSWORD} caracteres.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="invite-confirm" className="mb-1.5 block text-sm">
                      Confirme a senha
                    </Label>
                    <Input
                      id="invite-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && podeEnviar && void submit()}
                      aria-invalid={senhasDiferentes}
                    />
                    {senhasDiferentes && (
                      <p className="mt-1 text-xs text-destructive">As senhas não são iguais.</p>
                    )}
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button
                    onClick={() => void submit()}
                    disabled={!podeEnviar || saving || done}
                    className="gap-2"
                  >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {state.info.kind === 'convite' ? 'Criar minha conta' : 'Trocar senha e entrar'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
