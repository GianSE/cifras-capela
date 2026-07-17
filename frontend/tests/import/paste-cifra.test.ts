import { describe, it, expect } from 'vitest';
import { importPlainText, splitPastedSongs } from '../../src/lib/import/text-importer';
import {
  detectSectionHeader,
  isJunkLine,
  inferKeyFromText,
} from '../../src/lib/import/structure';
import { parse } from '../../src/lib/parser';

describe('detectSectionHeader', () => {
  it('reconhece cabeçalhos comuns de sites', () => {
    expect(detectSectionHeader('[Intro]')?.label).toBe('Intro');
    expect(detectSectionHeader('Refrão:')?.label).toBe('Refrão');
    expect(detectSectionHeader('Refrao')?.label).toBe('Refrão');
    expect(detectSectionHeader('1ª Estrofe')?.label).toBe('Verso 1');
    expect(detectSectionHeader('Verso 2')?.label).toBe('Verso 2');
    expect(detectSectionHeader('Ponte:')?.label).toBe('Ponte');
  });

  it('separa os acordes que vêm na mesma linha do cabeçalho', () => {
    const header = detectSectionHeader('Intro: G  C  D');
    expect(header?.label).toBe('Intro');
    expect(header?.rest).toBe('G  C  D');
  });

  it('não confunde uma frase da letra com cabeçalho', () => {
    expect(detectSectionHeader('Solo teu amor me basta a cada dia')).toBeNull();
    expect(detectSectionHeader('Final feliz é o que teremos')).toBeNull();
  });
});

describe('isJunkLine', () => {
  it('descarta tablatura, afinação e links', () => {
    expect(isJunkLine('E|--3--3--0--|')).toBe(true);
    expect(isJunkLine('Afinação: E A D G B E')).toBe(true);
    expect(isJunkLine('https://www.cifraclub.com.br/...')).toBe(true);
    expect(isJunkLine('(2x)')).toBe(true);
  });

  it('mantém letra e acordes', () => {
    expect(isJunkLine('Porque Ele vive')).toBe(false);
    expect(isJunkLine('G    C    D')).toBe(false);
  });
});

describe('inferKeyFromText', () => {
  it('deduz o tom do primeiro acorde', () => {
    expect(inferKeyFromText(['G    C    D', 'Porque Ele vive'])).toBe('G');
    expect(inferKeyFromText(['Em    Am', 'Letra'])).toBe('Em');
    expect(inferKeyFromText(['A7    D', 'Letra'])).toBe('A'); // ignora extensão
  });

  it('retorna undefined quando não há acordes', () => {
    expect(inferKeyFromText(['Só letra aqui', 'mais letra'])).toBeUndefined();
  });
});

describe('importPlainText — paste estilo CifraClub', () => {
  // Bloco realista: metadados, tablatura de intro, seções e acordes posicionais.
  const PASTE = `Porque Ele Vive
Harpa Cristã

Tom: G
Capotraste na 2ª casa

[Intro] G  C  D

Primeira Parte
    G          C        G
Deus enviou Seu Filho amado
       Em      A7        D
Para perdoar, para me salvar

[Refrão]
    G
Porque Ele vive
      C
Posso crer no amanhã
https://www.cifraclub.com.br/harpa`;

  const imported = importPlainText(PASTE);
  const { song, errors } = parse(
    `---\ntitle: ${imported.title}\nkey: ${imported.key}\n---\n${imported.body}`,
  );

  it('extrai título, artista, tom e capo', () => {
    expect(imported.title).toBe('Porque Ele Vive');
    expect(imported.artist).toBe('Harpa Cristã');
    expect(imported.key).toBe('G');
    expect(imported.capo).toBe(2);
  });

  it('descarta a linha de link (lixo)', () => {
    expect(imported.body).not.toContain('cifraclub');
  });

  it('converte os cabeçalhos em seções que o parser reconhece', () => {
    expect(errors).toEqual([]);
    const types = song.sections.filter((s) => s.type !== 'none').map((s) => s.type);
    // Intro (verse) + Primeira Parte (verse) + Refrão (chorus)
    expect(types).toContain('chorus');
    expect(types.filter((t) => t === 'verse').length).toBeGreaterThanOrEqual(2);
  });

  it('funde acordes posicionais na letra (inline)', () => {
    expect(imported.body).toContain('[G]');
    expect(imported.body).toContain('[C]');
    // Os acordes são inseridos na coluna, então a letra sem os [acordes] deve
    // reconstituir o texto original.
    const lyricsOnly = imported.body.replace(/\[[^\]]*\]/g, '');
    expect(lyricsOnly).toContain('Deus enviou Seu Filho amado');
    expect(lyricsOnly).toContain('Porque Ele vive');
  });
});

describe('splitPastedSongs', () => {
  it('divide em várias músicas nos separadores', () => {
    const blocks = splitPastedSongs('Música A\n[G]letra\n---\nMúsica B\n[C]letra');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('Música A');
    expect(blocks[1]).toContain('Música B');
  });

  it('aceita === e *** como separador', () => {
    expect(splitPastedSongs('A\n===\nB\n***\nC')).toHaveLength(3);
  });

  it('devolve uma única música quando não há separador', () => {
    expect(splitPastedSongs('Só uma música\n[G]aqui')).toHaveLength(1);
  });

  it('ignora blocos vazios entre separadores', () => {
    expect(splitPastedSongs('A\n---\n---\nB')).toHaveLength(2);
  });
});
