import { describe, it, expect } from 'vitest';
import { parse } from '../../src/lib/parser/parser';
import { serializeToFrontmatter } from '../../src/lib/parser/serializer';

/**
 * Testes do formato híbrido: frontmatter YAML + corpo ChordPro com seções
 * amigáveis (`{verso}`, `{refrão}`).
 */
describe('Frontmatter YAML + seções amigáveis', () => {
  it('extrai metadados do frontmatter', () => {
    const input = `---
title: Porque Ele Vive
artist: Harpa Cristã
key: G
tempo: 72
categories: [culto, santa ceia]
tags:
  - clássico
  - natal
language: pt
capo: 2
---

{verso 1}
[G]Porque Ele [C]vive
`;
    const result = parse(input);
    const { metadata } = result.song;

    expect(result.errors).toHaveLength(0);
    expect(metadata.title).toBe('Porque Ele Vive');
    expect(metadata.artist).toBe('Harpa Cristã');
    expect(metadata.key).toBe('G');
    expect(metadata.tempo).toBe(72);
    expect(metadata.categories).toEqual(['culto', 'santa ceia']);
    expect(metadata.tags).toEqual(['clássico', 'natal']);
    expect(metadata.language).toBe('pt');
    expect(metadata.capo).toBe(2);
  });

  it('reconhece seção amigável {verso 1} com rótulo', () => {
    const input = `---
title: Teste
---
{verso 1}
[G]Primeira linha
`;
    const result = parse(input);
    const sections = result.song.sections.filter((s) => s.type !== 'none');
    expect(sections).toHaveLength(1);
    expect(sections[0]!.type).toBe('verse');
    expect(sections[0]!.label).toBe('Verso 1');
  });

  it('auto-fecha a seção anterior ao iniciar {refrão}', () => {
    const input = `---
title: Teste
---
{verso 1}
[G]Linha do verso
{refrão}
[C]Linha do refrão
`;
    const result = parse(input);
    const sections = result.song.sections.filter((s) => s.type !== 'none');
    expect(sections).toHaveLength(2);
    expect(sections[0]!.type).toBe('verse');
    expect(sections[1]!.type).toBe('chorus');
    expect(sections[1]!.label).toBe('Refrão');
  });

  it('aceita bpm como alias de tempo', () => {
    const input = `---
title: Teste
bpm: 90
---
[G]Linha
`;
    const result = parse(input);
    expect(result.song.metadata.tempo).toBe(90);
  });

  it('mantém compatibilidade com ChordPro puro (sem frontmatter)', () => {
    const input = `{title: Clássico}
{key: D}
[D]Linha
`;
    const result = parse(input);
    expect(result.song.metadata.title).toBe('Clássico');
    expect(result.song.metadata.key).toBe('D');
  });

  it('frontmatter sem fechamento não é tratado como metadados', () => {
    const input = `---
title: Incompleto
[G]Linha`;
    const result = parse(input);
    // Sem `---` de fechamento, o bloco é tratado como corpo comum.
    expect(result.song.metadata.title).toBe('');
  });

  it('faz round-trip: parse → serializeToFrontmatter → parse', () => {
    const input = `---
title: Porque Ele Vive
artist: Harpa Cristã
key: G
tempo: 72
categories: [culto, santa ceia]
tags: [clássico]
language: pt
---

{verso 1}
[G]Porque Ele [C]vive
[D]posso crer no ama[G]nhã

{refrão}
[G]Porque Ele [G7]vive
`;
    const first = parse(input).song;
    const serialized = serializeToFrontmatter(first);
    const second = parse(serialized).song;

    expect(second.metadata.title).toBe('Porque Ele Vive');
    expect(second.metadata.artist).toBe('Harpa Cristã');
    expect(second.metadata.key).toBe('G');
    expect(second.metadata.tempo).toBe(72);
    expect(second.metadata.categories).toEqual(['culto', 'santa ceia']);
    expect(second.metadata.tags).toEqual(['clássico']);
    expect(second.metadata.language).toBe('pt');

    const sections = second.sections.filter((s) => s.type !== 'none');
    expect(sections).toHaveLength(2);
    expect(sections[0]!.type).toBe('verse');
    expect(sections[0]!.label).toBe('Verso 1');
    expect(sections[1]!.type).toBe('chorus');
    expect(sections[1]!.label).toBe('Refrão');
  });
});
