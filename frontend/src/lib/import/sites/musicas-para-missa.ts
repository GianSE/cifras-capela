/**
 * @module lib/import/sites/musicas-para-missa
 * @description Adaptador do **Músicas para Missa** (musicasparamissa.com.br).
 *
 * A página traz as três abas (Letra, Cifra e Informações) no mesmo HTML; a que
 * interessa é a da **cifra**, em `<pre id="div-cifra">`. Como a estrutura tem
 * nome próprio, dá para pegar mais do que o caminho genérico consegue: o
 * título sem o intérprete, quem canta e o momento da missa — que vira a
 * categoria da música, o mesmo rótulo que a biblioteca já usa.
 */

import { importPlainText, DEDUCED_TITLE_WARNING } from '../text-importer';
import type { ImportedSong } from '../types';

/**
 * Momento da missa → categoria, na ordem em que deve ser testado: "pós-comunhão"
 * antes de "comunhão", "ato penitencial" antes de "penitencial".
 */
const MOMENTOS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ATO\s+PENITENCIAL/, 'Ato penitencial'],
  [/P[OÓ]S[-\s]?COMUNH[AÃ]O|A[CÇ][AÃ]O\s+DE\s+GRA[CÇ]AS/, 'Pós-comunhão'],
  [/COMUNH[AÃ]O/, 'Comunhão'],
  [/ENTRADA/, 'Entrada'],
  [/GL[OÓ]RIA/, 'Glória'],
  [/SALMO/, 'Salmo'],
  [/ACLAMA[CÇ][AÃ]O/, 'Aclamação'],
  [/OFEREND|OFERT[OÓ]RIO/, 'Oferendas'],
  [/SANTO/, 'Santo'],
  [/CORDEIRO/, 'Cordeiro'],
  [/FINAL|DESPEDIDA/, 'Final'],
  [/AMBIENTA[CÇ][AÃ]O/, 'Ambientação'],
];

/** Momento da missa citado no texto ("CANTO DE COMUNHÃO PARA O…"). */
export function parseMomentoDaMissa(texto: string): string | undefined {
  const alvo = texto.toUpperCase();
  for (const [padrao, categoria] of MOMENTOS) {
    if (padrao.test(alvo)) return categoria;
  }
  return undefined;
}

/**
 * Texto de um bloco com as quebras de linha que o HTML representa em tags —
 * o `textContent` cru junta tudo numa linha só, e a aba de informações é uma
 * lista de rótulos, uma por linha.
 */
function textoEmLinhas(el: Element | null): string {
  if (!el) return '';
  const copia = el.cloneNode(true) as Element;
  copia.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  copia.querySelectorAll('p, div, li, h1, h2, h3, h4, strong, span').forEach((bloco) => {
    bloco.append('\n');
  });
  return (copia.textContent ?? '').replace(/[ \t]+/g, ' ');
}

/** `LETRA:`, `MÚSICA:`, `INTÉRPRETE:` — os rótulos da aba de informações. */
function campoDaInfo(info: string, rotulo: RegExp): string | undefined {
  for (const linha of info.split('\n')) {
    const valor = linha.trim().replace(rotulo, '').trim();
    if (valor !== linha.trim() && valor) return valor;
  }
  return undefined;
}

/**
 * O site escreve tudo em caixa alta. No título isso grita ao lado das outras
 * músicas da biblioteca, então vira "Senhor, Que Vieste Salvar" — as palavrinhas
 * de ligação ficam minúsculas, como se escreve em português.
 */
const MINUSCULAS = new Set([
  'a', 'à', 'ao', 'aos', 'as', 'às', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas',
  'no', 'nos', 'o', 'os', 'ou', 'para', 'pelo', 'pela', 'por', 'que', 'com', 'um', 'uma',
]);

export function capitalizar(texto: string): string {
  if (/[a-zà-ú]/.test(texto)) return texto; // já tem minúsculas: é do autor, não mexe.

  return texto
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+)/)
    .map((parte, i) => {
      if (/^\s+$/.test(parte) || parte === '') return parte;
      if (i > 0 && MINUSCULAS.has(parte.replace(/[^\wà-ú]/gi, ''))) return parte;
      return parte.replace(/\p{L}/u, (letra) => letra.toLocaleUpperCase('pt-BR'));
    })
    .join('');
}

/**
 * Parênteses do título que não são gente: "(1º 2º e 3º domingo)", "(3ª fórmula
 * do Missal Romano)". Viram nota, não artista.
 */
const NAO_E_ARTISTA = /\d|domingo|tempo\s+comum|ano\s+[abc]\b|f[oó]rmula|missal|quaresma|advento|p[aá]scoa/i;

/**
 * Lê a página do Músicas para Missa. Devolve `null` quando o HTML não é de lá —
 * aí o importador segue pelo caminho genérico.
 */
export function importMusicasParaMissa(doc: Document): ImportedSong | null {
  const pre = doc.querySelector('pre#div-cifra');
  const cifra = pre?.textContent ?? '';
  if (cifra.trim().length === 0) return null;

  const song = importPlainText(cifra);
  const info = textoEmLinhas(doc.querySelector('#info'));

  // "A BARCA (Padre Zezinho)": o parêntese diz quem canta, não faz parte do nome.
  const h1 = doc.querySelector('#titulo-musica')?.textContent?.trim() ?? '';
  const comParenteses = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(h1);
  const titulo = comParenteses?.[1]?.trim() || h1;
  const parenteses = comParenteses?.[2]?.trim();
  const entreParenteses = parenteses && !NAO_E_ARTISTA.test(parenteses) ? parenteses : undefined;

  // Quem canta: o rótulo da aba de informações, o parêntese do título (é o que
  // o site mostra ali) e, por último, quem compôs.
  const artista =
    campoDaInfo(info, /^INT[EÉ]RPRETE\s*:/i) ??
    entreParenteses ??
    campoDaInfo(info, /^M[UÚ]SICA\s*:/i);

  const categoria = parseMomentoDaMissa(info);

  return {
    ...song,
    ...(titulo && { title: capitalizar(titulo) }),
    ...(artista && { artist: capitalizar(artista) }),
    ...(categoria && { categories: [categoria] }),
    // O título veio do cabeçalho da página, não de um chute na primeira linha.
    warnings: titulo
      ? song.warnings.filter((w) => w !== DEDUCED_TITLE_WARNING)
      : song.warnings,
  };
}
