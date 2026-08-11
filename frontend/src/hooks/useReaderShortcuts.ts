import { useEffect } from 'react';

interface ReaderShortcuts {
  onTransposeUp: () => void;
  onTransposeDown: () => void;
  onToggleScroll: () => void;
  onFontIncrease?: () => void;
  onFontDecrease?: () => void;
  /** Esc: sair do modo palco ou voltar da música. */
  onExit?: () => void;
  /** Entrar no modo palco (tecla P). */
  onStage?: () => void;
  enabled?: boolean;
}

/**
 * Verdadeiro quando o foco está num campo de texto.
 *
 * Sem esta guarda, escrever "para" na busca dispararia a barra de espaço e
 * ligaria a rolagem automática no meio da digitação.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
  );
}

/**
 * Atalhos de teclado do leitor de cifra — pensados para quem toca com um
 * tablet ou notebook na estante e não quer mirar em botões pequenos:
 *
 *   ↑ / ↓        sobe e desce meio tom
 *   espaço       liga/desliga a rolagem automática
 *   + / −        tamanho da letra
 *   P            modo apresentação
 *   Esc          sai
 *
 * Ignora as teclas quando há um modificador (Ctrl/Alt/Meta), para não
 * atropelar atalhos do navegador como Ctrl+F ou Cmd+↓.
 */
export function useReaderShortcuts({
  onTransposeUp,
  onTransposeDown,
  onToggleScroll,
  onFontIncrease,
  onFontDecrease,
  onExit,
  onStage,
  enabled = true,
}: ReaderShortcuts) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onTransposeUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onTransposeDown();
          break;
        case ' ':
          // Sem `preventDefault` o espaço também rolaria a página.
          e.preventDefault();
          onToggleScroll();
          break;
        case '+':
        case '=':
          onFontIncrease?.();
          break;
        case '-':
        case '_':
          onFontDecrease?.();
          break;
        case 'p':
        case 'P':
          onStage?.();
          break;
        case 'Escape':
          onExit?.();
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    enabled,
    onTransposeUp,
    onTransposeDown,
    onToggleScroll,
    onFontIncrease,
    onFontDecrease,
    onExit,
    onStage,
  ]);
}
