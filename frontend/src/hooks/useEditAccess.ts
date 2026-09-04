import { useAuth } from './useAuth';

/**
 * Acesso de escrita (criar / editar / importar / excluir músicas).
 *
 * Salvar na biblioteca exige sessão: as rotas de escrita do Worker recusam
 * quem não apresenta o cookie. O editor em si continua aberto — ele serve
 * para montar e baixar um `.cho` mesmo sem conta.
 */
export function useEditAccess() {
  const { isEnabled, isSignedIn, isLoading } = useAuth();
  const canEdit = !isEnabled || isSignedIn;
  return {
    /** Pode salvar/editar de fato. */
    canEdit,
    /** Sessão ainda carregando (evita decidir cedo demais). */
    isLoading,
    /** Ninguém entrou — precisa logar para salvar. */
    needsLogin: isEnabled && !isSignedIn,
    /**
     * Mostrar botões/atalhos de escrita? Otimista enquanto a sessão carrega,
     * para não “piscar” escondido para quem já está logado.
     */
    showEditUI: isLoading || canEdit,
  };
}
