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

/** Chamada `push()` seguinte, quando o pedaço de texto atravessa mais de uma. */
const NEXT_CALL_RE = /^"\]\)\s*(?:<\/script>\s*<script[^>]*>\s*)?self\.__next_f\.push\(\[1,"/;

/** `\n`, `\"`, `\uXXXX`… — só o que `JSON.parse` também entenderia. */
const JSON_ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
};

/**
 * Letra comprida demais vira um pedaço de texto à parte no fluxo do React
 * (RSC/Flight), e o campo aponta pra lá em vez de trazer o texto junto:
 * `"lyrics":"$1d"`. O marcador desse pedaço (`1d:T<tamanho-hex>,`) tanto pode
 * abrir sua própria chamada `push()` quanto vir colado depois de outro JSON
 * na mesma — e o texto que segue, sem fim marcado, só termina depois de
 * exatos N bytes (o tamanho no marcador); por isso a leitura é byte a byte,
 * pulando por cima da emenda sempre que o texto atravessa uma chamada
 * seguinte, em vez de procurar por `"])` (que também aparece dentro do JSON
 * que vem OUTRA data real, bem maior).
 */
function resolveFlightTextRef(html: string, ref: string): string | undefined {
  const id = ref.replace(/^\$/, '');
  const marker = new RegExp(`${id}:T([0-9a-f]+),`).exec(html);
  if (!marker) return undefined;

  const targetBytes = Number.parseInt(marker[1]!, 16);
  const enc = new TextEncoder();
  let i = marker.index + marker[0].length;
  let bytes = 0;
  let cleaned = '';

  while (bytes < targetBytes && i < html.length) {
    const glue = NEXT_CALL_RE.exec(html.slice(i));
    if (glue) {
      i += glue[0].length;
      continue;
    }

    let raw: string;
    let decoded: string;
    if (html[i] === '\\' && html[i + 1] === 'u') {
      raw = html.slice(i, i + 6);
      decoded = String.fromCharCode(Number.parseInt(html.slice(i + 2, i + 6), 16));
    } else if (html[i] === '\\') {
      raw = html.slice(i, i + 2);
      decoded = JSON_ESCAPES[html[i + 1]!] ?? html[i + 1]!;
    } else {
      raw = html[i]!;
      decoded = raw;
    }
    cleaned += raw;
    bytes += enc.encode(decoded).length;
    i += raw.length;
  }

  try {
    return JSON.parse(`"${cleaned}"`) as string;
  } catch {
    return undefined;
  }
}

/**
 * Um campo `"chave":"valor"` do JSON embutido, parando antes do próximo campo.
 *
 * `scope` pode ser só um pedacinho do HTML (ex.: o bloco do artista) para não
 * casar o campo errado; `fullHtml` (o documento inteiro, por padrão o mesmo
 * `scope`) é onde o pedaço referenciado por "$1d" de fato mora.
 */
function extractField(scope: string, key: string, fullHtml: string = scope): string | undefined {
  const re = new RegExp(`\\\\"${key}\\\\":\\\\"(.*?)\\\\"(?=,\\\\"|\\})`, 's');
  const match = re.exec(scope);
  if (!match) return undefined;
  // Duas barras seguidas (`\\n`, `\\"`…) são um nível de escape sobrando.
  const collapsed = match[1]!.replace(/\\\\/g, '\\');
  let value: string;
  try {
    value = JSON.parse(`"${collapsed}"`) as string;
  } catch {
    return undefined;
  }
  // Valor é só uma referência ("$1d"): o texto de verdade mora em outro pedaço.
  return /^\$[0-9a-z]+$/i.test(value) ? (resolveFlightTextRef(fullHtml, value) ?? value) : value;
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
 * O editor do site injeta espaço de largura zero (U+200B a U+200D, mais o
 * BOM U+FEFF) espalhado pelo texto — invisível na tela deles, mas sobra na
 * letra importada. Os pontos de código, não os caracteres em si, evitam
 * qualquer ferramenta decidir "ajudar" e já aplicar os caracteres de verdade
 * aqui no código-fonte.
 */
const INVISIBLE_CODEPOINTS = [0x200b, 0x200c, 0x200d, 0xfeff];
function removeInvisibleChars(text: string): string {
  return Array.from(text)
    .filter((ch) => !INVISIBLE_CODEPOINTS.includes(ch.codePointAt(0)!))
    .join('');
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
  const artist = artistBlock && extractField(artistBlock, 'name', html);

  // O vídeo do YouTube (`youtube_url`) é lido pelo caminho genérico do
  // `html-importer`, que já sabe achar um link de YouTube em qualquer página.

  return {
    ...(title && { title: removeInvisibleChars(title) }),
    ...(artist && { artist: removeInvisibleChars(artist) }),
    ...(tone && { key: tone }),
    body: sectionsToBraces(removeInvisibleChars(lyrics.trim())),
    warnings: [],
  };
}
