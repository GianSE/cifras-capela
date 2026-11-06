import { useCallback, useEffect, useState } from 'react';
import { playlistStorage } from '@/lib/storage/playlists';

/** O que cada conta pode fazer. */
export type Role = 'admin' | 'leitor';

/** Quem está logado, do ponto de vista do app. */
export interface SessionUser {
  readonly id: number;
  readonly email: string;
  readonly name: string;
  /** `admin` faz tudo; `leitor` só consome o site. */
  readonly role: Role;
}

const ACCOUNT_KEY = 'cifras-capela:conta';

function rememberAccount(account: SessionUser | null): void {
  try {
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Sem armazenamento, só não abre sem internet.
  }
}

/** A última conta confirmada neste aparelho. Papel estranho vira o mais restrito. */
function lastAccount(): SessionUser | null {
  try {
    const stored = localStorage.getItem(ACCOUNT_KEY);
    const account = stored ? (JSON.parse(stored) as Partial<SessionUser>) : null;
    if (typeof account?.id !== 'number') return null;
    return {
      id: account.id,
      email: account.email ?? '',
      name: account.name ?? '',
      role: account.role === 'admin' ? 'admin' : 'leitor',
    };
  } catch {
    return null;
  }
}

/**
 * Sessão de quem edita a biblioteca.
 *
 * O token é um JWT assinado pelo Worker e guardado num cookie **httpOnly** —
 * o JavaScript da página não o alcança, então nem um XSS levaria a sessão
 * embora. O preço é que não dá para "ler" a sessão localmente: saber se há
 * alguém logado exige perguntar ao servidor (`GET /api/auth/me`).
 *
 * Não há cadastro pelo site: as contas são criadas por um administrador em
 * Mais › Usuários. É o acervo de uma comunidade, não um serviço com inscrição
 * aberta.
 */
export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Só o servidor dizendo que não tira da conta. Sem rede, ou com ele fora do ar,
    // segue a última conta: na igreja sem sinal, o repertório precisa abrir. Isto
    // decide só o que a tela mostra; quem protege os dados é a API, a cada pedido.
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.ok) {
          const account = (await res.json()) as SessionUser;
          rememberAccount(account);
          return account;
        }
        if (res.status === 401 || res.status === 403) {
          rememberAccount(null);
          return null;
        }
        return lastAccount();
      })
      .catch(() => lastAccount())
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

    const signed: SessionUser = {
      id: data.id ?? 0,
      email: data.email ?? email,
      name: data.name ?? '',
      role: data.role === 'admin' ? 'admin' : 'leitor',
    };
    rememberAccount(signed);
    setUser(signed);
    playlistStorage.setSession(signed.id);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    // Quem apaga o cookie é o servidor: httpOnly não se apaga pelo cliente.
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
      () => undefined,
    );
    rememberAccount(null);
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
    /** Pode criar, editar, importar e excluir — inclusive contas. */
    isAdmin: user?.role === 'admin',
    isLoading,
    signIn,
    signOut,
  };
}
