import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseEnabled } from '@/lib/supabase/client';

/** Deixa os erros de login legíveis em português. */
function traduzirErroAuth(message: string): string {
  if (/Invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(message)) {
    return 'E-mail ainda não confirmado. Confirme-o no painel do Supabase.';
  }
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Sem conexão.';
  return message;
}

/**
 * Sessão do Supabase (login por e-mail e senha).
 *
 * A anon key é pública, então é o login que autoriza a escrita: as políticas
 * de RLS só liberam insert/update/delete para e-mails listados na tabela
 * `editors`. Ler é público — quem abre o app não precisa entrar para ver as
 * cifras.
 *
 * Não há tela de cadastro de propósito: o usuário é criado uma vez no painel
 * do Supabase (Authentication → Users → Add user). É uma biblioteca pessoal;
 * cadastro aberto só ampliaria a superfície de ataque.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseEnabled);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  /** Entra com e-mail e senha. */
  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    if (!supabase) throw new Error('Supabase não está configurado.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(traduzirErroAuth(error.message));
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await supabase?.auth.signOut();
  }, []);

  return {
    /** Supabase configurado? Se não, o app é somente leitura. */
    isEnabled: isSupabaseEnabled,
    session,
    isSignedIn: session !== null,
    isLoading,
    signIn,
    signOut,
  };
}
