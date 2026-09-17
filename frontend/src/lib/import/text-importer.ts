/**
 * @module lib/import/text-importer
 * @description Importa cifras em texto puro (colado de sites, TXT, PDF/HTML já
 * limpo), extraindo metadados por heurística, reconhecendo seções e
 * convertendo acordes posicionais (acima da letra) em inline.
 */
import { isChordLine } from './chord-detection';
import { mergeChordLine, chordOnlyToInline } from './positional';
import { detectSectionHeader, isJunkLine, inferKeyFromText } from './structure';
import type { ImportedSong } from './types';

const KEY_RE = /(?:tom|key|tonalidade|cifra em)\s*[:-]?\s*([A-G][#b]?m?)\b/i;
const ARTIST_RE = /(?:artista|int[eé]rprete|banda|autor[a]?)\s*[:-]\s*(.+)/i;
const TITLE_RE = /(?:t[ií]tulo|title|m[uú]sica)\s*[:-]\s*(.+)/i;
const TEMPO_RE = /(?:bpm|tempo|andamento)\s*[:-]?\s*(\d{2,3})\b/i;
const CAPO_RE = /(?:capo|capotraste)(?:\s+na)?\s*[:-]?\s*(\d{1,2})/i;

/** Separadores que dividem várias cifras coladas de uma vez. */
const SONG_SEPARATOR = /^\s*(?:-{3,}|={3,}|\*{3,}|%{3,})\s*$/;

/**
 * Divide um texto colado em várias músicas, se houver separadores explícitos
 * (`---`, `===`, `***`). Sem separadores, devolve a única música.
 */
export function splitPastedSongs(raw: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    if (SONG_SEPARATOR.test(line)) {
      if (current.some((l) => l.trim() !== '')) blocks.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.some((l) => l.trim() !== '')) blocks.push(current.join('\n'));
  return blocks.length > 0 ? blocks : [raw];
}

/**
 * Aviso de que o título foi adivinhado a partir do texto. Exportado para quem
 * tem uma fonte melhor (o `<title>` de uma página) saber que pode substituí-lo.
 */
export const DEDUCED_TITLE_WARNING = 'Título deduzido da primeira linha — confira.';

/** Início do aviso de tom adivinhado — o acorde varia, então compara-se o começo. */
export const DEDUCED_KEY_WARNING_PREFIX = 'Tom deduzido do primeiro acorde';
export const MISSING_KEY_WARNING = 'Tonalidade não identificada — defina manualmente.';

/** Converte um bloco de texto em uma música importada (corpo ChordPro inline). */
export function importPlainText(raw: string): ImportedSong {
  const warnings: string[] = [];
  const normalized = raw.replace(/\r\n?/g, '\n');
  const allLines = normalized.split('\n');

  const meta: Pick<ImportedSong, 'title' | 'artist' | 'key' | 'tempo' | 'capo'> = {};
  const consumed = new Set<number>();

  // Extrai metadados rotulados e marca linhas de lixo para descarte.
  allLines.forEach((line, i) => {
    if (isJunkLine(line)) {
      consumed.add(i);
      return;
    }
    let m: RegExpExecArray | null;
    if (!meta.key && (m = KEY_RE.exec(line))) {
      meta.key = m[1];
      consumed.add(i);
    }
    if (!meta.artist && (m = ARTIST_RE.exec(line))) {
      meta.artist = m[1]!.trim();
      consumed.add(i);
    }
    if (!meta.title && (m = TITLE_RE.exec(line))) {
      meta.title = m[1]!.trim();
      consumed.add(i);
    }
    if (!meta.tempo && (m = TEMPO_RE.exec(line))) {
      meta.tempo = Number.parseInt(m[1]!, 10);
      consumed.add(i);
    }
    if (meta.capo === undefined && (m = CAPO_RE.exec(line))) {
      meta.capo = Number.parseInt(m[1]!, 10);
      consumed.add(i);
    }
  });

  const contentLines = allLines.filter((_, i) => !consumed.has(i));

  const isProse = (l: string) => l.trim() !== '' && !isChordLine(l) && !detectSectionHeader(l);
  const isMusic = (l: string) => isChordLine(l) || Boolean(detectSectionHeader(l));

  // Título implícito: só no cabeçalho, isto é, nas linhas de texto que vêm
  // ANTES do primeiro acorde ou seção. Procurar no arquivo inteiro fazia a
  // primeira frase da letra virar título — e sumir do corpo — sempre que a
  // cifra começava direto na música, como no CifraClub (`[Intro] G A ...`).
  if (!meta.title) {
    const firstMusic = contentLines.findIndex(isMusic);
    const header = firstMusic < 0 ? contentLines : contentLines.slice(0, firstMusic);
    const firstText = header.find(isProse);
    if (firstText) {
      meta.title = firstText.trim();
      contentLines.splice(contentLines.indexOf(firstText), 1);
      warnings.push(DEDUCED_TITLE_WARNING);

      // Artista implícito: a linha curta logo abaixo do título, também ainda
      // no cabeçalho — depois do primeiro acorde, já é letra.
      if (!meta.artist) {
        const idx = contentLines.findIndex((l) => l.trim() !== '');
        const candidate = idx >= 0 ? contentLines[idx]! : undefined;
        const musicStart = contentLines.findIndex(isMusic);
        if (
          candidate &&
          (musicStart < 0 || idx < musicStart) &&
          isProse(candidate) &&
          candidate.trim().length <= 40 &&
          !/[.[\]]/.test(candidate)
        ) {
          meta.artist = candidate.trim();
          contentLines.splice(idx, 1);
        }
      }
    }
  }

  // Tom implícito: primeiro acorde do corpo.
  if (!meta.key) {
    const inferred = inferKeyFromText(contentLines);
    if (inferred) {
      meta.key = inferred;
      warnings.push(`${DEDUCED_KEY_WARNING_PREFIX} (${inferred}) — confira.`);
    } else {
      warnings.push(MISSING_KEY_WARNING);
    }
  }

  // Converte o corpo: seções + acordes posicionais → inline.
  const body: string[] = [];
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i]!;

    const section = detectSectionHeader(line);
    if (section) {
      body.push(`{${section.label}}`);
      // Acordes na mesma linha do cabeçalho (ex.: "Intro: G C D").
      if (section.rest && isChordLine(section.rest)) {
        body.push(chordOnlyToInline(section.rest));
      } else if (section.rest) {
        body.push(section.rest);
      }
      continue;
    }

    if (isChordLine(line)) {
      const next = contentLines[i + 1];
      if (next !== undefined && next.trim() !== '' && !isChordLine(next) && !detectSectionHeader(next)) {
        body.push(mergeChordLine(line, next));
        i++; // consome a linha de letra
      } else {
        body.push(chordOnlyToInline(line));
      }
    } else {
      body.push(line.replace(/\s+$/, ''));
    }
  }

  return {
    ...meta,
    body: body.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    warnings,
  };
}
