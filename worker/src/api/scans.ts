/**
 * Folhas: fotos e PDFs de cifra guardados no R2 para transcrever depois.
 *
 * Na correria do ensaio só dá tempo de fotografar a folha — então o envio só
 * guarda o arquivo, sem processar nada. Mais tarde o "Transcrever" gera um
 * rascunho da cifra (IA com visão, quando há chave; senão o app cai para o OCR
 * do aparelho), a pessoa corrige e confirma, e a folha fica ligada à música
 * como cópia de segurança do original.
 *
 * Quem cadastra é o administrador. A exceção é abrir o arquivo: uma folha pode ser
 * a música que o grupo vai tocar, então basta estar logado, como para ler a cifra.
 *
 * Rotas:
 *   GET    /api/scans                 → lista (mais recentes primeiro)
 *   POST   /api/scans                 → envia (corpo = o arquivo cru)
 *   GET    /api/scans/<id>            → uma folha
 *   GET    /api/scans/<id>/file       → o arquivo original
 *   POST   /api/scans/<id>/transcribe → rascunho da cifra em texto
 *   PATCH  /api/scans/<id>            → { songId, status? } liga à música (padrão: validada)
 *   DELETE /api/scans/<id>            → apaga a folha e o arquivo
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../types';
import { json, readJson, methodNotAllowed, unauthorized } from '../lib/http';
import { currentAccount, forbidden } from '../lib/access';

/** Foto de celular passa fácil de 5 MB; PDF escaneado, de 10. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Formatos aceitos → extensão usada no nome guardado. */
const ACCEPTED_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

/** Imagens que a IA lê direto (HEIC precisa ser convertido no aparelho). */
type AiImageType = 'image/jpeg' | 'image/png' | 'image/webp';
const AI_IMAGE_TYPES = new Set<string>(['image/jpeg', 'image/png', 'image/webp']);

/** Limite de imagem da API (base64 decodificado ~5 MB). */
const MAX_AI_IMAGE_BYTES = 5 * 1024 * 1024;

const MODEL = 'claude-opus-5-5';

interface ScanRow {
  id: string;
  user_id: number;
  filename: string;
  content_type: string;
  size: number;
  status: string;
  song_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToScan(row: ScanRow) {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    size: row.size,
    status: row.status === 'validada' ? 'validada' : 'pendente',
    songId: row.song_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Onde o arquivo mora no bucket. */
const objectKey = (id: string) => `folhas/${id}`;

function createScanId(): string {
  return `fl_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

/** Nome mandado pelo app (vem codificado num header). Nunca lança. */
function readFilename(request: Request, fallback: string): string {
  const raw = request.headers.get('X-Filename');
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw).replace(/[\\/]/g, '_').slice(0, 120) || fallback;
  } catch {
    return fallback;
  }
}

export async function scansRoute(request: Request, env: Env, pathname: string): Promise<Response> {
  const account = await currentAccount(request, env);
  if (!account) return unauthorized();

  if (!env.SCANS) {
    return json({ error: 'O armazenamento de folhas (R2) não está configurado no servidor.' }, 503);
  }
  const bucket = env.SCANS;

  // /api/scans[/<id>[/<acao>]]
  const parts = pathname
    .slice('/api/scans'.length)
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));
  const [id, action] = parts;

  const readingFile = action === 'file' && request.method === 'GET';
  if (account.role !== 'admin' && !readingFile) return forbidden();

  if (!id) {
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT * FROM scans ORDER BY created_at DESC LIMIT 500`,
      ).all<ScanRow>();
      return json(
        { scans: (results ?? []).map(rowToScan), aiAvailable: Boolean(env.ANTHROPIC_API_KEY) },
        200,
        { 'Cache-Control': 'no-store' },
      );
    }
    if (request.method === 'POST') return upload(request, env, bucket, account.id);
    return methodNotAllowed();
  }

  const row = await env.DB.prepare(`SELECT * FROM scans WHERE id = ?`).bind(id).first<ScanRow>();
  if (!row) return json({ error: 'Folha não encontrada.' }, 404);

  if (action === 'file') {
    if (request.method !== 'GET') return methodNotAllowed();
    const object = await bucket.get(objectKey(id));
    if (!object) return json({ error: 'O arquivo desta folha sumiu do armazenamento.' }, 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': row.content_type,
        'Content-Length': String(object.size),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        // Original não muda: o navegador pode guardar, mas só para esta pessoa.
        'Cache-Control': 'private, max-age=86400',
      },
    });
  }

  if (action === 'transcribe') {
    if (request.method !== 'POST') return methodNotAllowed();
    return transcribe(request, env, bucket, row);
  }

  if (action) return json({ error: 'Not implemented' }, 501);

  if (request.method === 'GET') {
    return json({ scan: rowToScan(row), aiAvailable: Boolean(env.ANTHROPIC_API_KEY) }, 200, {
      'Cache-Control': 'no-store',
    });
  }

  if (request.method === 'PATCH') {
    const body = await readJson<{ songId: string | null; status: string }>(request);
    const songId =
      typeof body.songId === 'string' && body.songId.trim() ? body.songId.trim() : null;
    await env.DB.prepare(
      `UPDATE scans SET song_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(songId, songId && body.status !== 'pendente' ? 'validada' : 'pendente', id)
      .run();
    const updated = await env.DB.prepare(`SELECT * FROM scans WHERE id = ?`)
      .bind(id)
      .first<ScanRow>();
    return json({ scan: updated ? rowToScan(updated) : null });
  }

  if (request.method === 'DELETE') {
    await bucket.delete(objectKey(id));
    await env.DB.prepare(`DELETE FROM scans WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  }

  return methodNotAllowed();
}

/** Guarda o arquivo como veio — é o backup, não se mexe na qualidade. */
async function upload(
  request: Request,
  env: Env,
  bucket: R2Bucket,
  userId: number,
): Promise<Response> {
  const contentType = (request.headers.get('Content-Type') ?? '').split(';')[0]!.trim();
  const ext = ACCEPTED_TYPES[contentType];
  if (!ext) {
    return json({ error: 'Envie uma foto (JPG, PNG, WEBP, HEIC) ou um PDF.' }, 415);
  }

  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_FILE_BYTES) return json({ error: 'Arquivo grande demais (máx. 25 MB).' }, 413);

  const data = await request.arrayBuffer();
  if (data.byteLength === 0) return json({ error: 'Arquivo vazio.' }, 400);
  if (data.byteLength > MAX_FILE_BYTES) {
    return json({ error: 'Arquivo grande demais (máx. 25 MB).' }, 413);
  }

  const id = createScanId();
  const filename = readFilename(request, `folha.${ext}`);

  await bucket.put(objectKey(id), data, {
    httpMetadata: { contentType },
    customMetadata: { filename, userId: String(userId) },
  });

  try {
    await env.DB.prepare(
      `INSERT INTO scans (id, user_id, filename, content_type, size, status)
       VALUES (?, ?, ?, ?, ?, 'pendente')`,
    )
      .bind(id, userId, filename, contentType, data.byteLength)
      .run();
  } catch (err) {
    // Sem a linha no banco o arquivo ficaria órfão no bucket.
    await bucket.delete(objectKey(id));
    throw err;
  }

  const row = await env.DB.prepare(`SELECT * FROM scans WHERE id = ?`).bind(id).first<ScanRow>();
  return json({ scan: row ? rowToScan(row) : null }, 201);
}

const TRANSCRIBE_PROMPT = `Esta é a foto (ou PDF) de uma folha de cifra musical, geralmente de música católica em português.

Transcreva a cifra em texto puro, exatamente neste formato:

Título: <título da música>
Artista: <artista ou autor, se aparecer>
Tom: <tom, se aparecer ou se for óbvio pelo primeiro acorde>

[Intro] <acordes da introdução, se houver>

[Verso 1]
G           D/F#        Em
Letra da música com os acordes
C              D
na linha de cima

[Refrão]
...

Regras:
- Cada acorde fica na linha acima da letra, na coluna exata da sílaba em que ele cai (pense em fonte monoespaçada).
- Use a notação de acordes da folha (G, Em7, D/F#, Bb, F#m7(b5)...). Não transponha.
- Marque as partes com [Intro], [Verso 1], [Verso 2], [Pré-refrão], [Refrão], [Ponte], [Solo] ou [Final].
- Repetições como "2x" ou "(bis)" ficam no fim da linha da letra.
- Omita as linhas Artista/Tom quando não houver essa informação.
- Se um trecho estiver ilegível, escreva (?) no lugar em vez de inventar.
- Responda somente com a cifra: nada de comentários, explicações, markdown ou blocos de código.`;

/**
 * Pede à IA o rascunho da cifra. Sem chave configurada responde 501 com
 * `fallback: true`, e o app usa o OCR local.
 *
 * Imagens chegam do app já reduzidas (o original de uma câmera passa do
 * limite da API e gastaria tokens à toa); o PDF vai como está no bucket.
 */
async function transcribe(
  request: Request,
  env: Env,
  bucket: R2Bucket,
  row: ScanRow,
): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'Transcrição por IA não configurada.', fallback: true }, 501);
  }

  let source: Anthropic.Beta.BetaContentBlockParam;

  if (row.content_type === 'application/pdf') {
    const object = await bucket.get(objectKey(row.id));
    if (!object) return json({ error: 'O arquivo desta folha sumiu do armazenamento.' }, 404);
    const data = toBase64(await object.arrayBuffer());
    source = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data },
    };
  } else {
    const body = await readJson<{ image: string; mediaType: string }>(request);
    const mediaType = typeof body.mediaType === 'string' ? body.mediaType : '';
    const image = typeof body.image === 'string' ? body.image : '';
    if (!image || !AI_IMAGE_TYPES.has(mediaType)) {
      return json({ error: 'Imagem para transcrever não enviada.', fallback: true }, 400);
    }
    if ((image.length * 3) / 4 > MAX_AI_IMAGE_BYTES) {
      return json({ error: 'Imagem grande demais para a IA.', fallback: true }, 413);
    }
    source = {
      type: 'image',
      source: { type: 'base64', media_type: mediaType as AiImageType, data: image },
    };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Ler acorde por acorde e alinhar com a sílaba pede algum raciocínio,
      // mas não o máximo: `medium` equilibra custo e acerto.
      output_config: { effort: 'medium' },
      // Se o modelo recusar por política, o servidor tenta outro sozinho.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: [source, { type: 'text', text: TRANSCRIBE_PROMPT }] }],
    });

    if (response.stop_reason === 'refusal') {
      return json({ error: 'A IA não conseguiu transcrever esta folha.', fallback: true }, 422);
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      // Garantia: se mesmo assim vier cercado de ``` , tira.
      .replace(/^\s*```[a-z]*\n?|\n?```\s*$/g, '')
      .trim();

    if (!text) return json({ error: 'A IA não devolveu texto.', fallback: true }, 422);

    return json({
      text,
      truncated: response.stop_reason === 'max_tokens',
      model: response.model,
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Chave da Anthropic inválida.');
      return json({ error: 'A chave da IA é inválida.', fallback: true }, 502);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json(
        { error: 'A IA está ocupada — tente de novo em instantes.', fallback: true },
        429,
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Erro da API da Anthropic (${error.status}):`, error.message);
      return json({ error: 'A IA não respondeu.', fallback: true }, 502);
    }
    console.error('Falha ao transcrever:', error);
    return json({ error: 'A IA não respondeu.', fallback: true }, 502);
  }
}

/** ArrayBuffer → base64, em blocos (spread de 10 MB estouraria a pilha). */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
