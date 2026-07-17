/**
 * @module lib/import/structure
 * @description Reconhece a estrutura de uma cifra colada de sites (CifraClub,
 * Ultimate Guitar…): cabeçalhos de seção, linhas de lixo e o tom implícito.
 */
import { parseChordString } from '@/lib/transpose/chord-parser';
import { findChordPositions, isChordLine } from './chord-detection';

/**
 * Palavra da seção (como aparece no site) → rótulo emitido.
 *
 * O rótulo emitido precisa começar com uma palavra que o **parser** reconheça
 * como seção (veja `SECTION_KEYWORDS` em `lib/parser/parser.ts`). Por isso
 * `estrofe`/`parte` viram `Verso`, e não um marcador que o parser ignoraria.
 */
const SECTION_ALIASES: Readonly<Record<string, string>> = {
  intro: 'Intro',
  introducao: 'Intro',
  'introdução': 'Intro',
  verso: 'Verso',
  estrofe: 'Verso',
  parte: 'Verso',
  'pré-refrão': 'Pré-refrão',
  'pre-refrao': 'Pré-refrão',
  'pré-refrao': 'Pré-refrão',
  'pre-refrão': 'Pré-refrão',
  refrao: 'Refrão',
  'refrão': 'Refrão',
  coro: 'Refrão',
  estribilho: 'Refrão',
  ponte: 'Ponte',
  bridge: 'Ponte',
  solo: 'Solo',
  final: 'Final',
  outro: 'Final',
  encerramento: 'Final',
  'interlúdio': 'Interlúdio',
  interludio: 'Interlúdio',
};

/** Ordinais por extenso → número (ex.: "Primeira Parte"). */
const ORDINALS: Readonly<Record<string, string>> = {
  primeira: '1',
  primeiro: '1',
  segunda: '2',
  segundo: '2',
  terceira: '3',
  terceiro: '3',
  quarta: '4',
  quarto: '4',
  quinta: '5',
  quinto: '5',
};

export interface SectionHeader {
  /** Rótulo pronto para o marcador, ex.: `Verso 1`, `Refrão`. */
  readonly label: string;
  /** O que sobrou na mesma linha (às vezes os acordes da intro). */
  readonly rest: string;
}

/** Normaliza um token: minúsculo e sem o marcador ordinal `ª`/`º`. */
function normToken(token: string): string {
  return token.toLowerCase().replace(/[ªº.:]/g, '');
}

/**
 * Detecta um cabeçalho de seção — em qualquer ordem: `Refrão`, `[Intro] G C`,
 * `1ª Estrofe`, `Primeira Parte`, `Verso 2`.
 *
 * Retorna `null` quando a linha é letra comum (evita falso positivo em versos
 * que começam com "Solo", "Final"…): exige que a linha seja curta e que, além
 * da palavra da seção, só haja número/ordinal — ou acordes, no caso da intro.
 */
export function detectSectionHeader(line: string): SectionHeader | null {
  const bare = line.trim().replace(/^\[|\]$/g, '').trim();
  if (bare === '') return null;

  // Separa um eventual "resto" após dois-pontos ou colchete (acordes da intro).
  const colon = bare.search(/[:\]]/);
  const headPart = colon >= 0 ? bare.slice(0, colon) : bare;
  const rest = colon >= 0 ? bare.slice(colon + 1).trim() : '';

  const tokens = headPart.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) return null;

  let canonical: string | undefined;
  let number: string | undefined;

  for (const token of tokens) {
    const norm = normToken(token);
    if (SECTION_ALIASES[norm]) {
      canonical = SECTION_ALIASES[norm];
    } else if (/^\d+$/.test(norm)) {
      number = norm;
    } else if (ORDINALS[norm]) {
      number = ORDINALS[norm];
    } else {
      return null; // token estranho → não é cabeçalho
    }
  }

  if (!canonical) return null;

  // Sem dois-pontos/colchete, o "resto" só é válido se forem acordes (intro).
  const hadDelimiter = /[[\]:]/.test(line);
  if (rest !== '' && !hadDelimiter && !isChordLine(rest)) return null;

  return {
    label: number ? `${canonical} ${number}` : canonical,
    rest,
  };
}

/** Linhas que são claramente ruído e devem ser descartadas. */
const JUNK_PATTERNS: readonly RegExp[] = [
  /^\s*[eEADGBb]\|/, // tablatura: E|---3---
  /\|[-\d]+\|[-\d]+\|/, // mais tablatura
  /^\s*afina[çc][ãa]o/i,
  /https?:\/\//i,
  /cifra\s?club|ultimate\s?guitar|ver coment|no aplicativo|tocar no app/i,
  /^\s*\(?\s*\d+\s*x\s*\)?\s*$/i, // repetições soltas: "2x", "(3x)"
];

/** A linha é ruído importado do site? */
export function isJunkLine(line: string): boolean {
  return JUNK_PATTERNS.some((re) => re.test(line));
}

/**
 * Deduz o tom a partir do primeiro acorde encontrado — convenção comum das
 * cifras ("cifra em G"). Preserva a menoridade (`Em`), ignora extensões
 * (`G7` → `G`). Retorna `undefined` se não houver acordes.
 */
export function inferKeyFromText(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    if (!isChordLine(line)) continue;
    const first = findChordPositions(line)[0];
    if (!first) continue;
    const chord = parseChordString(first.chord);
    if (!chord) continue;
    const minor = chord.quality.startsWith('m') && !chord.quality.startsWith('maj') ? 'm' : '';
    return `${chord.root}${chord.accidental ?? ''}${minor}`;
  }
  return undefined;
}
