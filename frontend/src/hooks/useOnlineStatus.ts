import { useEffect, useState } from 'react';

/**
 * Se o aparelho está com rede.
 *
 * `navigator.onLine` só sabe que existe *alguma* conexão — dá falso positivo
 * num wi-fi sem internet. Serve para o aviso, mas não para decidir se vale
 * tentar buscar: quem decide isso é o `catch` de quem faz a requisição.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
