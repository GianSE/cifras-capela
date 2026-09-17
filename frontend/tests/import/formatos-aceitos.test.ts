import { describe, it, expect } from 'vitest';
import { ACCEPTED_FILE_TYPES, importFile } from '../../src/lib/import';

describe('importar arquivo — só .pdf, .cho, .jpg e .png', () => {
  it('o seletor oferece só esses formatos', () => {
    const extensions = ACCEPTED_FILE_TYPES.split(',').filter((t) => t.startsWith('.'));
    expect(extensions.sort()).toEqual(['.cho', '.jpeg', '.jpg', '.pdf', '.png']);
  });

  it.each(['cifra.txt', 'cifra.json', 'cifra.html', 'cifra.md'])('recusa %s', async (name) => {
    const file = new File(['[G]letra'], name);
    await expect(importFile(file)).rejects.toThrow(/Formato não aceito/);
  });

  it('lê um .cho', async () => {
    const file = new File(['---\ntitle: Teste\nkey: G\n---\n\n[G]Porque Ele vive\n'], 'teste.cho');
    const song = await importFile(file);
    expect(song.title).toBe('Teste');
    expect(song.body).toContain('[G]Porque');
  });
});
