import { describe, it, expect } from 'vitest';
import { DEDUCED_TITLE_WARNING, importPlainText } from '../../src/lib/import/text-importer';
import { importHtml } from '../../src/lib/import/html-importer';

/**
 * Começo real de "Terra Seca" no CifraClub: nenhuma linha de cabeçalho, a
 * cifra abre direto em `[Intro]`. Era aqui que a primeira frase da letra
 * sumia — o título implícito procurava "a primeira linha de texto" no
 * arquivo inteiro e achava a letra.
 */
const PRE = `[Intro] G  A  F#m  Bm
        Em  A
        D2  D9/F#  G6(9)

[Primeira Parte]

            D2         D9/F#       G6(9)
Somente em ti construirei a minha casa
            D2       D9/F#         G6(9)
Somente em ti colocarei minha esperança`;

describe('cifra que começa direto na música', () => {
  it('não transforma a primeira frase da letra em título', () => {
    const song = importPlainText(PRE);
    expect(song.title).not.toBe('Somente em ti construirei a minha casa');
  });

  it('mantém a primeira frase no corpo, com os acordes em cima dela', () => {
    const song = importPlainText(PRE);
    expect(song.body).toContain('construir');
    expect(song.body).toMatch(/Somente em t\[D2\]i construir\[D9\/F#\]ei a minha c\[G6\(9\)\]asa/);
  });

  it('não deixa uma linha só de acordes órfã no começo do verso', () => {
    const song = importPlainText(PRE);
    const verso = song.body.split('\n{Verso 1}')[1] ?? song.body;
    const primeira = verso.split('\n').find((l) => l.trim() !== '');
    expect(primeira).not.toMatch(/^(\[[^\]]+\]\s*)+$/);
  });

  it('continua deduzindo o título quando ele vem antes dos acordes', () => {
    const song = importPlainText(`Porque Ele Vive\n\n    G\nPorque Ele vive`);
    expect(song.title).toBe('Porque Ele Vive');
  });
});

describe('página do CifraClub', () => {
  // O <title> real termina em " - Cifra Club", que o filtro de lixo do site
  // descartava — e com ele iam embora o título e o artista verdadeiros.
  const HTML = `<!doctype html><html><head>
<title>Terra Seca - Fraternidade São João Paulo II - Cifra Club</title></head>
<body><pre>${PRE}</pre></body></html>`;

  it('usa título e artista do <title>, sem o nome do site', () => {
    const song = importHtml(HTML);
    expect(song.title).toBe('Terra Seca');
    expect(song.artist).toBe('Fraternidade São João Paulo II');
  });

  it('não perde a primeira frase da letra', () => {
    expect(importHtml(HTML).body).toContain('construir');
  });

  it('não avisa "título deduzido" quando o título veio da página', () => {
    // Só o aviso de título: o de tom ("Tom deduzido do primeiro acorde")
    // continua valendo, porque o tom realmente é adivinhado.
    expect(importHtml(HTML).warnings).not.toContain(DEDUCED_TITLE_WARNING);
  });
});

describe('tom informado pela página do CifraClub', () => {
  // Bloco real do seletor de tom (classes são geradas e mudam; `id="key"` e
  // os aria-labels não). O "Tom" é o rótulo; o valor é o `<p>` entre os botões.
  const KEY_BOX = `<div class="bentoCardContent eDVGi" id="key"><div class="DCqes"><p class="_5QAC">Tom</p></div>
<div class="N0qCA"><button aria-label="Diminuir tom"></button><span class="_QG2y"><p class="_5QAC HjnxC">D</p></span>
<button aria-label="Aumentar tom"></button></div></div>`;

  const pagina = (extra: string) => `<!doctype html><html><head>
<title>Terra Seca - Fraternidade São João Paulo II - Cifra Club</title></head>
<body>${extra}<pre>${PRE}</pre></body></html>`;

  it('usa o tom da página em vez de adivinhar pelo primeiro acorde', () => {
    // Pelo primeiro acorde daria "Em" (a linha do [Intro] é pulada); é D.
    expect(importHtml(pagina(KEY_BOX)).key).toBe('D');
  });

  it('tira o aviso de tom deduzido quando o tom veio da página', () => {
    const avisos = importHtml(pagina(KEY_BOX)).warnings.join(' ');
    expect(avisos).not.toMatch(/Tom deduzido|Tonalidade não identificada/);
  });

  it('sem o bloco de tom, continua deduzindo (e avisando)', () => {
    const song = importHtml(pagina(''));
    expect(song.key).toBeTruthy();
    expect(song.warnings.join(' ')).toMatch(/Tom deduzido/);
  });

  it('ignora um id="key" que não traga um tom válido', () => {
    const song = importHtml(pagina('<div id="key"><p>Tom</p><p>Chave de acesso</p></div>'));
    expect(song.key).not.toBe('Chave de acesso');
    expect(song.warnings.join(' ')).toMatch(/Tom deduzido/);
  });
});
