import { describe, it, expect } from 'vitest';
import { parseYoutubeId, setYoutubeInSource } from '../../src/lib/youtube';
import { parsePageYoutube, importHtml } from '../../src/lib/import/html-importer';
import { parse, serializeToFrontmatter } from '../../src/lib/parser';
import { deriveIndexEntry } from '../../src/lib/library/derive';
import { buildSource } from '../../src/lib/import';

const ID = 'vpp-DP1JTLk';

describe('parseYoutubeId — links colados', () => {
  it.each([
    [ID],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`],
    [`https://youtu.be/${ID}?si=abc`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://music.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`youtube.com/watch?v=${ID}`],
    [`  ${ID}  `],
  ])('%s', (input) => {
    expect(parseYoutubeId(input)).toBe(ID);
  });

  it.each([
    [''],
    ['não é link'],
    ['https://vimeo.com/123456789'],
    ['https://www.youtube.com/@cifraclub'],
    ['https://evil.com/watch?v=vpp-DP1JTLk'],
    ['vpp-DP1JTLk"><script>'],
  ])('recusa %s', (input) => {
    expect(parseYoutubeId(input)).toBeUndefined();
  });
});

describe('CifraClub — o vídeo vem junto ao importar pelo link', () => {
  it('lê o youtubeID dos dados da página (aspas escapadas)', () => {
    const html = `<script>self.__next_f.push([1,"{\\"verified\\":true,\\"youtubeID\\":\\"${ID}\\",\\"blocks\\":{}}"])</script>`;
    expect(parsePageYoutube(html)).toBe(ID);
  });

  it('lê o youtubeID em JSON comum', () => {
    expect(parsePageYoutube(`{"youtubeID":"${ID}"}`)).toBe(ID);
  });

  it('importHtml preenche o vídeo', () => {
    const html = `<html><head><title>Tu És o Centro - Frei Gilson - Cifra Club</title></head>
      <body><pre>[Intro] G  D\n\nG        D\nTu és o centro</pre>
      <script>{"youtubeID":"${ID}"}</script></body></html>`;
    expect(importHtml(html).youtube).toBe(ID);
  });

  it('sem vídeo na página, fica sem', () => {
    expect(parsePageYoutube('<html><a href="https://www.youtube.com/cifraclub">canal</a></html>')).toBeUndefined();
  });
});

describe('campo youtube no .cho', () => {
  const source = `---\ntitle: Tu És o Centro\nartist: Frei Gilson\nkey: G\nyoutube: https://youtu.be/${ID}\n---\n\n[G]Tu és o centro\n`;

  it('o parser guarda só o id, mesmo com link completo', () => {
    expect(parse(source).song.metadata.youtube).toBe(ID);
  });

  it('link inválido vira aviso, sem quebrar a música', () => {
    const { song, errors } = parse(source.replace(`https://youtu.be/${ID}`, 'qualquer coisa'));
    expect(song.metadata.youtube).toBeUndefined();
    expect(errors.some((e) => e.message.includes('YouTube'))).toBe(true);
  });

  it('vai para o índice da biblioteca (play nos cards)', () => {
    expect(deriveIndexEntry('louvor/tu-es-o-centro', source).youtube).toBe(ID);
  });

  it('sobrevive ao round-trip do serializador', () => {
    const again = parse(serializeToFrontmatter(parse(source).song)).song;
    expect(again.metadata.youtube).toBe(ID);
  });

  it('a importação grava o campo no .cho', () => {
    const cho = buildSource({ title: 'X', body: '[G]x', warnings: [], youtube: ID });
    expect(parse(cho).song.metadata.youtube).toBe(ID);
  });
});

describe('setYoutubeInSource — salva o vídeo sem reescrever a cifra', () => {
  const cho = `---\r\ntitle: A\r\nkey: G\r\n---\r\n\r\n{Verso}\r\n[G]letra   com   espaços\r\n`;

  it('adiciona no frontmatter preservando o resto (e o CRLF)', () => {
    const out = setYoutubeInSource(cho, ID);
    expect(out).toBe(`---\r\ntitle: A\r\nkey: G\r\nyoutube: ${ID}\r\n---\r\n\r\n{Verso}\r\n[G]letra   com   espaços\r\n`);
  });

  it('troca o vídeo existente em vez de duplicar', () => {
    const out = setYoutubeInSource(setYoutubeInSource(cho, 'aaaaaaaaaaa'), ID);
    expect(out.match(/youtube:/g)).toHaveLength(1);
    expect(parse(out).song.metadata.youtube).toBe(ID);
  });

  it('remove quando vazio', () => {
    expect(setYoutubeInSource(setYoutubeInSource(cho, ID), undefined)).toBe(cho);
  });

  it('ChordPro puro recebe a diretiva', () => {
    const out = setYoutubeInSource('{title: A}\n[G]letra', ID);
    expect(parse(out).song.metadata.youtube).toBe(ID);
    expect(parse(out).song.metadata.title).toBe('A');
  });
});
