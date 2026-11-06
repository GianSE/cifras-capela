/**
 * @module lib/missa
 * @description As partes da missa e as regras de uma playlist do tipo missa.
 *
 * Funções puras: o `playlistStorage` usa para montar e alterar as partes, e
 * as telas para saber em que parte cada música está.
 */

import type { Playlist, PlaylistSection } from '@/types/playlist';

/** Partes com que toda missa nova começa, na ordem da celebração. */
export const DEFAULT_MISSA_SECTIONS: readonly string[] = [
  'Ambientação',
  'Entrada',
  'Ato penitencial',
  'Glória',
  'Salmo',
  'Aclamação ao Evangelho',
  'Ofertório',
  'Santo',
  'Cordeiro',
  'Comunhão',
  'Final',
];

/** Sugestões de partes extras, oferecidas ao adicionar uma parte. */
export const EXTRA_MISSA_SECTIONS: readonly string[] = [
  'Pós-comunhão',
  'Amém',
  'Pai-Nosso',
  'Abraço da paz',
  'Ação de graças',
  'Aspersão',
  'Ofertório (2ª)',
  'Comunhão (2ª)',
  'Mariana',
];

/** Gera um ID curto para uma parte. */
export function createSectionId(): string {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** As partes padrão, vazias e com ids novos. */
export function createDefaultSections(): PlaylistSection[] {
  return DEFAULT_MISSA_SECTIONS.map((name) => ({ id: createSectionId(), name, songIds: [] }));
}

/** True se a playlist é organizada pelas partes da missa. */
export function isMissa(playlist: Playlist): boolean {
  return playlist.kind === 'missa' && Array.isArray(playlist.sections);
}

/** Todas as músicas das partes, na ordem da missa (sem repetir). */
export function flattenSections(sections: readonly PlaylistSection[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const section of sections) {
    for (const songId of section.songIds) {
      if (seen.has(songId)) continue;
      seen.add(songId);
      ids.push(songId);
    }
  }
  return ids;
}

/** A parte em que a música está, se houver. */
export function sectionOf(playlist: Playlist, songId: string): PlaylistSection | undefined {
  return playlist.sections?.find((s) => s.songIds.includes(songId));
}

/**
 * Deixa uma playlist vinda do armazenamento consistente: numa missa, a lista
 * achatada é sempre recalculada a partir das partes (a fonte da verdade).
 */
export function normalizePlaylist(playlist: Playlist): Playlist {
  if (playlist.kind !== 'missa') return playlist;
  const sections = Array.isArray(playlist.sections) ? playlist.sections : createDefaultSections();
  return { ...playlist, sections, songIds: flattenSections(sections) };
}

/** Troca as partes e recalcula a lista achatada junto. */
export function withSections(playlist: Playlist, sections: readonly PlaylistSection[]): Playlist {
  return { ...playlist, sections, songIds: flattenSections(sections) };
}

/* ==========================================================================
   Data da missa

   Uma missa é identificada pela data, então o nome da playlist é a própria
   data por extenso ("Domingo, 08/11/2026"). Datas circulam como `AAAA-MM-DD`
   (o formato do campo de data do navegador) e são sempre lidas no horário
   local: passar por UTC faria a noite de sábado virar domingo no Brasil.
   ========================================================================== */

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Data daqui a `days` dias (somando no calendário, à prova de horário de verão). */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Sábado e domingo sugeridos para a próxima missa: os do fim de semana que vem
 * pela frente. No sábado, sugere hoje e amanhã; no domingo, já o fim de semana
 * seguinte (a data de hoje continua disponível no campo de data).
 */
export function suggestMissaDates(today: Date = new Date()): {
  saturday: string;
  sunday: string;
} {
  const weekday = today.getDay();
  const toSaturday = weekday === 0 ? 6 : 6 - weekday;
  return {
    saturday: toIsoDate(addDays(today, toSaturday)),
    sunday: toIsoDate(addDays(today, toSaturday + 1)),
  };
}

/** `2026-11-08` → `Domingo, 08/11/2026`. Data inválida volta como veio. */
export function formatMissaName(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return `${WEEKDAYS[date.getDay()]}, ${day}/${month}/${year}`;
}

/** Caminho inverso: a data no nome da missa, ou `undefined` se o nome for livre. */
export function parseMissaDate(name: string): string | undefined {
  const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(name);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}
