/**
 * @module lib/import/capitalize
 * @description Padroniza título e artista vindos de sites que escrevem tudo em
 * caixa alta — comum em cifras digitadas à mão. Usado por `startReview`, então
 * vale para **qualquer** jeito de importar (link, busca, arquivo, texto colado).
 */

/** Conectivos que ficam minúsculos, como se escreve em português. */
const MINUSCULAS = new Set([
  'a', 'à', 'ao', 'aos', 'as', 'às', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas',
  'no', 'nos', 'o', 'os', 'ou', 'para', 'pelo', 'pela', 'por', 'que', 'com', 'um', 'uma',
]);

/**
 * "SENHOR, QUE VIESTE SALVAR" → "Senhor, que Vieste Salvar".
 *
 * Só mexe em texto **inteiramente** em caixa alta — qualquer letra minúscula já
 * presente é sinal de que quem escreveu quis aquela forma, então o texto sai
 * como veio.
 */
export function capitalizar(texto: string): string {
  if (/[a-zà-ú]/.test(texto)) return texto;

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
