import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { importHtml } from '../../src/lib/import/html-importer';

/** Recorte do payload de uma página real do decifrando.app.br. */
const PAGINA = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/decifrando.html'),
  'utf-8',
);

describe('Decifrando — importar pelo link', () => {
  const song = importHtml(PAGINA);

  it('lê título, tom e artista do JSON embutido na página', () => {
    expect(song.title).toBe('A Ti Meu Deus');
    expect(song.key).toBe('D');
    expect(song.artist).toBe('Músicas Católicas & Convidados');
  });

  it('já vem com os acordes em ChordPro inline, sem precisar juntar linhas', () => {
    expect(song.body).toContain('[D]Deus');
    expect(song.body).toContain('[A7/E]');
  });

  it('troca o colchete da seção por chave — só acorde usa colchete', () => {
    expect(song.body).toContain('{Refrão}');
    expect(song.body).not.toContain('[Refrão]');
  });

  it('traz o vídeo do YouTube que a página embute', () => {
    expect(song.youtube).toBe('xCRPZRB08nI');
  });

  it('não avisa que o título foi adivinhado — veio do JSON da página', () => {
    expect(song.warnings.join(' ')).not.toContain('Título deduzido');
  });
});
