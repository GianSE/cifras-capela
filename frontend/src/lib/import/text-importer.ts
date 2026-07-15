/**
 * @module lib/import/text-importer
 * @description Importa cifras em texto puro (TXT/PDF/HTML já limpo), extraindo
 * metadados por heurística e convertendo acordes posicionais em inline.
 */
import { isChordLine } from './chord-detection';
import { mergeChordLine, chordOnlyToInline } from './positional';
import type { ImportedSong } from './types';

const KEY_RE = /(?:tom|key|tonalidade|cifra em)\s*[:\-]?\s*([A-G][#b]?m?)\b/i;
const ARTIST_RE = /(?:artista|int[eé]rprete|banda|autor[a]?)\s*[:\-]\s*(.+)/i;
const TITLE_RE = /(?:t[ií]tulo|title|m[uú]sica)\s*[:\-]\s*(.+)/i;
const TEMPO_RE = /(?:bpm|tempo|andamento)\s*[:\-]?\s*(\d{2,3})\b/i;
const CAPO_RE = /(?:capo|capotraste)\s*[:\-]?\s*(\d{1,2})\b/i;

/** Converte um bloco de texto em uma música importada (corpo ChordPro inline). */
export function importPlainText(raw: string): ImportedSong {
  const warnings: string[] = [];
  const normalized = raw.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  const meta: Pick<ImportedSong, 'title' | 'artist' | 'key' | 'tempo' | 'capo'> = {};
  const consumed = new Set<number>();

  // Extrai metadados rotulados.
  lines.forEach((line, i) => {
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

  // Título/artista implícitos: primeiras linhas de texto não consumidas.
  const contentLines = lines.filter((_, i) => !consumed.has(i));
  if (!meta.title) {
    const firstText = contentLines.find((l) => l.trim() !== '' && !isChordLine(l));
    if (firstText) {
      meta.title = firstText.trim();
      const idx = contentLines.indexOf(firstText);
      contentLines.splice(idx, 1);
      warnings.push('Título deduzido da primeira linha — confira.');
    }
  }
  if (!meta.artist) {
    const firstText = contentLines.find((l) => l.trim() !== '' && !isChordLine(l));
    // Considera artista apenas se for uma linha curta (heurística).
    if (firstText && firstText.trim().length <= 40 && !/[.[\]]/.test(firstText)) {
      // Não remove automaticamente para não engolir a letra; apenas sugere.
    }
  }

  // Converte o corpo: acordes posicionais → inline.
  const body: string[] = [];
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i]!;
    if (isChordLine(line)) {
      const next = contentLines[i + 1];
      if (next !== undefined && next.trim() !== '' && !isChordLine(next)) {
        body.push(mergeChordLine(line, next));
        i++; // consome a linha de letra
      } else {
        body.push(chordOnlyToInline(line));
      }
    } else {
      body.push(line.replace(/\s+$/, ''));
    }
  }

  if (!meta.key) warnings.push('Tonalidade não identificada — defina manualmente.');

  return {
    ...meta,
    body: body.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    warnings,
  };
}
