import { useCallback, useEffect, useState } from 'react';
import { playlistStorage } from '@/lib/storage/playlists';

/** Quem está logado, do ponto de vista do app. */
export interface SessionUser {
  readonly id: number;
  readonly email: string;
  readonly name: string;
}

/**
 * Sessão de quem edita a biblioteca.
 *
 * O token é um JWT assinado pelo Worker e guardado num cookie **httpOnly** —
 * o JavaScript da página não o alcança, então nem um XSS levaria a sessão
 * embora. O preço é que não dá para "ler" a sessão localmente: saber se há
 * alguém logado exige perguntar ao servidor (`GET /api/auth/me`).
 *
 * Não há cadastro pelo site: os administradores são criados por SQL
 * (`worker/scripts/criar-admin.mjs`). É o acervo de uma comunidade, não um
 * serviço com inscrição aberta.
 */
export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? (res.json() as Promise<SessionUser>) : null))
      .catch(() => null) // Offline: segue como visitante, sem quebrar a tela.
      .then((data) => {
        if (!mounted) return;
        setUser(data);
        // O cookie é httpOnly: as playlists não têm como saber quem entrou.
        playlistStorage.setSession(data?.id ?? null);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('Sem conexão.');
    }

    const data = (await res.json().catch(() => ({}))) as Partial<SessionUser> & { error?: string };
    if (!res.ok) throw new Error(data.error ?? 'Não foi possível entrar.');

    const signed = { id: data.id ?? 0, email: data.email ?? email, name: data.name ?? '' };
    setUser(signed);
    playlistStorage.setSession(signed.id);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    // Quem apaga o cookie é o servidor: httpOnly não se apaga pelo cliente.
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
      () => undefined,
    );
    setUser(null);
    playlistStorage.setSession(null);
  }, []);

  return {
    /**
     * Mantido por compatibilidade com as telas: agora a escrita é sempre
     * possível em princípio (o Worker é parte do próprio site), então isto é
     * constante. Some quando as telas pararem de perguntar.
     */
    isEnabled: true,
    user,
    /** Formato antigo (`session.user.email`), para não mexer nas telas. */
    session: user ? { user: { email: user.email } } : null,
    isSignedIn: user !== null,
    isLoading,
    signIn,
    signOut,
  };
}
