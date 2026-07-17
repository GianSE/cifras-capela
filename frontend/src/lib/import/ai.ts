/**
 * @module lib/import/ai
 * @description Cliente do formatador com IA (endpoint `/api/format` do Worker).
 *
 * A chamada ao Claude acontece no Worker (a chave fica lá, nunca no navegador).
 * Em dev (só Vite, sem Worker) o endpoint não existe — `isAiFormatterAvailable`
 * retorna `false` e o app simplesmente esconde o botão.
 */

export interface AiFormatResult {
  /** O arquivo `.cho` gerado (frontmatter + corpo). */
  readonly source: string;
  /** Avisos sobre o que ficou incerto na conversão. */
  readonly warnings: readonly string[];
}

/** Verifica se o formatador com IA está configurado no servidor. */
export async function isAiFormatterAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/format', { method: 'GET' });
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}

/** Envia o texto bruto e recebe a cifra formatada em ChordPro. */
export async function formatWithAI(text: string): Promise<AiFormatResult> {
  const res = await fetch('/api/format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<AiFormatResult> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error ?? 'Não foi possível formatar com IA.');
  }
  return { source: data.source ?? '', warnings: data.warnings ?? [] };
}
