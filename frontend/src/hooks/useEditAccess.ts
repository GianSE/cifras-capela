import { useAuth } from './useAuth';

/**
 * Acesso de escrita (criar / editar / importar / excluir músicas).
 *
 * O site inteiro exige conta; o que separa as pessoas é o papel: administrador
 * faz tudo, leitor só consome. As rotas de escrita do Worker recusam quem não
 * é administrador, então a interface esconde o que não adianta oferecer.
 */
export function useEditAccess() {
  const { isSignedIn, isAdmin, isLoading } = useAuth();

  return {
    /** Pode salvar/editar de fato. */
    canEdit: isAdmin,
    /** Sessão ainda carregando (evita decidir cedo demais). */
    isLoading,
    /** Ninguém entrou — precisa logar. */
    needsLogin: !isSignedIn,
    /** Entrou, mas só para ler. */
    isReader: isSignedIn && !isAdmin,
    /**
     * Mostrar botões/atalhos de escrita? Otimista enquanto a sessão carrega,
     * para não “piscar” escondido para quem já está logado.
     */
    showEditUI: isLoading || isAdmin,
  };
}
