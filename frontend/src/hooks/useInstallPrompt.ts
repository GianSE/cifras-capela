import { useCallback, useEffect, useState } from 'react';

/** O evento não está na lib padrão do TypeScript (é proposta, não padrão). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Convite para instalar o app na tela inicial.
 *
 * Instalar é o que de fato torna o app utilizável sem rede — abre em tela
 * cheia e com os arquivos já em cache. O navegador só oferece o convite uma
 * vez, num evento que precisa ser guardado no instante em que chega; se
 * deixarmos passar, não há como pedir de novo depois.
 *
 * Não funciona no iOS, que não implementa o evento: lá a instalação é manual
 * (Compartilhar › Adicionar à Tela de Início) — daí o texto de ajuda na tela
 * de configurações.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(display-mode: standalone)').matches,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Sem isto o Chrome mostra a sua própria barra, fora do desenho do app.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // O evento é de uso único: guardá-lo depois disso não serve para nada.
    setDeferred(null);
  }, [deferred]);

  return { canInstall: deferred !== null, installed, promptInstall };
}
