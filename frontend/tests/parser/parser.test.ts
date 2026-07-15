import { describe, it, expect } from 'vitest';
import { parse } from '../../src/lib/parser/parser';

describe('ChordPro Parser', () => {
  it('parses metadata correctly', () => {
    const input = `
{title: Porque Ele Vive}
{artist: Harpa Cristã}
{key: G}
{tempo: 72}
`;
    const result = parse(input);
    expect(result.errors).toHaveLength(0);
    expect(result.song.metadata.title).toBe('Porque Ele Vive');
    expect(result.song.metadata.artist).toBe('Harpa Cristã');
    expect(result.song.metadata.key).toBe('G');
    expect(result.song.metadata.tempo).toBe(72);
  });

  it('parses chords and lyrics correctly', () => {
    const input = `
{title: Teste}
[G]Porque Ele vive
[C]Posso crer no a[G]manhã
`;
    const result = parse(input);
    const sections = result.song.sections.filter(s => s.type !== 'none' || s.lines.some(l => l.type !== 'empty'));
    expect(sections).toHaveLength(1);
    
    const lines = sections[0].lines.filter(l => l.type !== 'empty');
    expect(lines).toHaveLength(2);
    
    // First line: "[G]Porque Ele vive"
    expect(lines[0].segments).toHaveLength(1);
    expect(lines[0].segments[0].chord?.root).toBe('G');
    expect(lines[0].segments[0].lyric).toBe('Porque Ele vive');
    
    // Second line: "[C]Posso crer no a[G]manhã"
    expect(lines[1].segments).toHaveLength(2);
    expect(lines[1].segments[0].chord?.root).toBe('C');
    expect(lines[1].segments[0].lyric).toBe('Posso crer no a');
    expect(lines[1].segments[1].chord?.root).toBe('G');
    expect(lines[1].segments[1].lyric).toBe('manhã');
  });

  it('parses sections correctly', () => {
    const input = `
{title: Teste}
{start_of_verse: Verso 1}
Letra do verso
{end_of_verse}

{start_of_chorus}
Letra do refrão
{end_of_chorus}
`;
    const result = parse(input);
    const sections = result.song.sections.filter(s => s.type !== 'none');
    expect(sections).toHaveLength(2);
    
    expect(sections[0].type).toBe('verse');
    expect(sections[0].label).toBe('Verso 1');
    const verseLines = sections[0].lines.filter(l => l.type !== 'empty');
    expect(verseLines[0].segments[0].lyric).toBe('Letra do verso');

    expect(sections[1].type).toBe('chorus');
    expect(sections[1].label).toBeUndefined();
    const chorusLines = sections[1].lines.filter(l => l.type !== 'empty');
    expect(chorusLines[0].segments[0].lyric).toBe('Letra do refrão');
  });

  it('handles missing title gracefully with warning', () => {
    const input = `
{artist: Teste}
Letra da música
`;
    const result = parse(input);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Título da música não definido');
    expect(result.errors[0].severity).toBe('warning');
  });
});
