/**
 * @module lib/import/sites/decifrando
 * @description Adaptador do **Decifrando** (decifrando.app.br).
 *
 * O site é um app em React (Next.js): o HTML inicial não tem `<pre>` nem
 * texto de letra nenhum, tudo vem de um JSON embutido num `<script>` (o
 * payload do React Server Components). Esse JSON já traz os acordes em
 * ChordPro inline (`"A Ti meu [D]Deus"`) — o mesmo formato que o corpo da
 * música usa aqui — então não há acordes posicionais para juntar, só ler os
 * campos certos.
 *
 * O JSON chega escapado duas vezes: as aspas de cada campo têm uma barra só
 * (`\"`), mas o que estava escapado *dentro* do texto original (quebra de
 * linha, `&`, aspas de verdade) ganhou uma barra extra na volta — por isso
 * dois níveis de `\` colapsam em um antes do `JSON.parse` do valor.
 */
import type { ImportedSong } from '../types';

/** Um campo `"chave":"valor"` do JSON embutido, parando antes do próximo campo. */
function extractField(text: string, key: string): string | undefined {
  const re = new RegExp(`\\\\"${key}\\\\":\\\\"(.*?)\\\\"(?=,\\\\"|\\})`, 's');
  const match = re.exec(text);
  if (!match) return undefined;
  // Duas barras seguidas (`\\n`, `\\"`…) são um nível de escape sobrando.
  const collapsed = match[1]!.replace(/\\\\/g, '\\');
  try {
    return JSON.parse(`"${collapsed}"`) as string;
  } catch {
    return undefined;
  }
}

/** `[Refrão]`, `[Intro]`… numa linha só — igual às seções do resto do app. */
const SECTION_LINE_RE =
  /^\[(intro|introdução|verso|estrofe|parte|pré-refrão|refrão|coro|estribilho|ponte|bridge|solo|final|outro|interlúdio)\s*\d*\]$/i;

/** Capitaliza a primeira letra de cada palavra da seção: "refrão" → "Refrão". */
function sectionLabel(bracketed: string): string {
  return bracketed
    .slice(1, -1)
    .replace(/^pré-refrão$/i, 'Pré-refrão')
    .replace(/^(intro|introdução)$/i, 'Intro')
    .replace(/^(verso|estrofe|parte)(\s*\d*)$/i, (_m, _w, n: string) => `Verso${n}`)
    .replace(/^(refrão|coro|estribilho)$/i, 'Refrão')
    .replace(/^(ponte|bridge)$/i, 'Ponte')
    .replace(/^solo$/i, 'Solo')
    .replace(/^(final|outro)$/i, 'Final')
    .replace(/^interlúdio$/i, 'Interlúdio');
}

/** `[Refrão]` → `{Refrão}`: o corpo usa colchetes só para acorde. */
function sectionsToBraces(body: string): string {
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      return SECTION_LINE_RE.test(trimmed) ? `{${sectionLabel(trimmed)}}` : line;
    })
    .join('\n');
}

/**
 * Lê a página do Decifrando. Devolve `null` quando o HTML não é de lá —
 * aí o importador segue pelo caminho genérico.
 */
export function importDecifrando(html: string): ImportedSong | null {
  if (!/decifrando/i.test(html)) return null;

  const lyrics = extractField(html, 'lyrics');
  if (!lyrics) return null;

  const title = extractField(html, 'title');
  const tone = extractField(html, 'tone');
  const artistBlock = /\\"artist\\":\{.*?\}/s.exec(html)?.[0];
  const artist = artistBlock && extractField(artistBlock, 'name');

  // O vídeo do YouTube (`youtube_url`) é lido pelo caminho genérico do
  // `html-importer`, que já sabe achar um link de YouTube em qualquer página.

  return {
    ...(title && { title }),
    ...(artist && { artist }),
    ...(tone && { key: tone }),
    body: sectionsToBraces(lyrics.trim()),
    warnings: [],
  };
}
