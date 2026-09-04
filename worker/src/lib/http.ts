/** Utilitários de resposta compartilhados entre o roteador e as rotas da API. */

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/** Corpo JSON da requisição, ou `{}` quando ausente/malformado. */
export async function readJson<T>(request: Request): Promise<Partial<T>> {
  return request
    .json<T>()
    .then((v) => (v && typeof v === 'object' ? v : ({} as Partial<T>)))
    .catch(() => ({}) as Partial<T>);
}

export const methodNotAllowed = () => json({ error: 'Método não permitido.' }, 405);
export const unauthorized = () => json({ error: 'Não autenticado.' }, 401);
