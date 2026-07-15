/**
 * @module types
 * @description Barrel export de todos os tipos do domínio.
 */
export type {
  NoteName,
  Accidental,
  NoteDescriptor,
  Chord,
  Segment,
  LineType,
  Line,
  SectionType,
  Section,
  SongMetadata,
  Song,
  ParseSeverity,
  ParseError,
  ParseResult,
} from './song';

export type { SongIndexEntry } from './library';
