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

export type AiConfidence = 'alta' | 'media' | 'baixa';

export interface AiGenerateResult extends AiFormatResult {
  /** Confiança da IA na letra/acordes gerados. */
  readonly confidence: AiConfidence;
}

export interface SongCandidate {
  readonly title: string;
  readonly artist?: string;
  /** Primeira linha da letra — para reconhecer qual é. */
  readonly firstLine: string;
  readonly key?: string;
  readonly confidence: AiConfidence;
}

/** Lista músicas que a IA conhece com esse nome, ordenadas por confiança. */
export async function findSongCandidates(
  title: string,
  artist?: string,
): Promise<SongCandidate[]> {
  const res = await fetch('/api/song-candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, artist }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    candidates?: SongCandidate[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? 'Não foi possível buscar músicas.');
  return data.candidates ?? [];
}

/** Pede à IA a cifra de uma música conhecida (pelo nome). */
export async function generateWithAI(input: {
  title: string;
  artist?: string;
  key?: string;
  /** Trecho da letra — ajuda a IA a identificar a música certa. */
  excerpt?: string;
}): Promise<AiGenerateResult> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<AiGenerateResult> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error ?? 'Não foi possível gerar com IA.');
  }
  return {
    source: data.source ?? '',
    warnings: data.warnings ?? [],
    confidence: data.confidence ?? 'baixa',
  };
}
