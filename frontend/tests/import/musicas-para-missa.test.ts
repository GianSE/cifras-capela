import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { importHtml } from '../../src/lib/import/html-importer';
import {
  capitalizar,
  parseMomentoDaMissa,
} from '../../src/lib/import/sites/musicas-para-missa';

/** Recorte de uma página real do musicasparamissa.com.br. */
const PAGINA = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/musicas-para-missa.html'),
  'utf-8',
);

describe('Músicas para Missa — importar pelo link', () => {
  const song = importHtml(PAGINA);

  it('pega a aba Cifra, não a da Letra', () => {
    // A letra (sem acordes) também está na página; o corpo tem de vir com acordes.
    expect(song.body).toContain('[Bm]');
    // Os acordes entram no meio das palavras; a letra se confere sem eles.
    const letra = song.body.replace(/\[[^\]]*\]/g, '');
    expect(letra).toContain('SENHOR QUE VIESTES SALVAR');
    expect(song.body).not.toMatch(/^1\. SENHOR QUE VIESTES SALVAR$/m);
  });

  it('tira o intérprete do título e o usa como artista', () => {
    expect(song.title).toBe('Senhor, que Vieste Salvar');
    expect(song.artist).toBe('Coral Canção Nova');
  });

  it('deduz a categoria pelo momento da missa', () => {
    expect(song.categories).toEqual(['Ato penitencial']);
  });

  it('traz o vídeo do YouTube que a página embute', () => {
    expect(song.youtube).toBe('jwAiZQcg-3k');
  });

  it('não avisa que o título foi adivinhado — veio do cabeçalho', () => {
    expect(song.warnings.join(' ')).not.toContain('Título deduzido');
  });
});

describe('momento da missa → categoria', () => {
  it.each([
    ['ATO PENITENCIAL (3ª FÓRMULA DO MISSAL ROMANO)', 'Ato penitencial'],
    ['CANTO DE COMUNHÃO PARA O 3º DOMINGO', 'Comunhão'],
    ['CANTO DE AÇÃO DE GRAÇAS', 'Pós-comunhão'],
    ['CANTO DE APRESENTAÇÃO DAS OFERENDAS PARA', 'Oferendas'],
    ['SALMO RESPONSORIAL', 'Salmo'],
    ['CANTO FINAL', 'Final'],
  ])('%s', (info, esperado) => {
    expect(parseMomentoDaMissa(info)).toBe(esperado);
  });

  it('sem momento reconhecido, não inventa categoria', () => {
    expect(parseMomentoDaMissa('LETRA: MISSAL ROMANO')).toBeUndefined();
  });
});

describe('título em caixa alta', () => {
  it('vira maiúsculas só onde importa', () => {
    expect(capitalizar('A BARCA')).toBe('A Barca');
    expect(capitalizar('SENHOR, QUE VIESTE SALVAR')).toBe('Senhor, que Vieste Salvar');
  });

  it('respeita quem já escreveu com minúsculas', () => {
    expect(capitalizar('Tu És o Centro')).toBe('Tu És o Centro');
  });
});
