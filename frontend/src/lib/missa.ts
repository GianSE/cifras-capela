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
