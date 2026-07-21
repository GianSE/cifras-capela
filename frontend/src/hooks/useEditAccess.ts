import { useAuth } from './useAuth';

/**
 * Acesso de escrita (criar / editar / importar / excluir músicas).
 *
 * - Supabase **desligado**: modo somente-arquivo — o editor ainda serve para
 *   montar e baixar `.cho`, então é liberado.
 * - Supabase **ligado**: escrever exige login (o RLS só libera os e-mails da
 *   tabela `editors`).
 */
export function useEditAccess() {
  const { isEnabled, isSignedIn, isLoading } = useAuth();
  const canEdit = !isEnabled || isSignedIn;
  return {
    /** Pode salvar/editar de fato. */
    canEdit,
    /** Sessão ainda carregando (evita decidir cedo demais). */
    isLoading,
    /** Supabase ligado, mas ninguém entrou — precisa logar. */
    needsLogin: isEnabled && !isSignedIn,
    /**
     * Mostrar botões/atalhos de escrita? Otimista enquanto a sessão carrega,
     * para não “piscar” escondido para quem já está logado.
     */
    showEditUI: isLoading || canEdit,
  };
}
