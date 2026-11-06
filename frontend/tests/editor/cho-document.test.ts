import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from '../../src/lib/parser';
import {
  addChord,
  chordRow,
  editLyric,
  getField,
  isChordOnly,
  lineSegments,
  lineToText,
  lyricLine,
  mergeLines,
  moveChord,
  nudgeChord,
  parseDocument,
  parseLyricLine,
  removeChord,
  sectionName,
  serializeDocument,
  setChord,
  setField,
  splitLine,
  usedChords,
  type LyricLine,
} from '../../src/lib/editor/cho-document';

const line = (raw: string) => lyricLine(raw);
const text = (l: LyricLine) => lineToText(l);

describe('abrir e não mexer devolve o arquivo idêntico', () => {
  const dir = path.resolve(__dirname, '../fixtures');
  const fixtures = readdirSync(dir).filter((f) => f.endsWith('.cho'));

  it.each(fixtures)('%s', (name) => {
    const source = readFileSync(path.join(dir, name), 'utf-8');
    expect(serializeDocument(parseDocument(source))).toBe(source);
  });

  it.each([
    ['sem frontmatter', '[G]Letra\n{refrão}\n[C]Mais\n'],
    ['formato antigo', '{title: Teste}\n{key: G}\n{soc}\n[G]Letra\n{eoc}\n'],
    ['quebras do Windows', '---\r\ntitle: A\r\n---\r\n\r\n[G]Letra\r\n'],
    ['sem quebra no fim', '---\ntitle: A\n---\n[G]Letra'],
    ['comentários e espaços', '# nota\n   \n  [G]Recuada  \n\n\n'],
    ['acorde vazio e estranho', '[]oi [xyz]tudo [ G ]bem'],
    ['colchete sem par', 'Letra [ sem fechar\nOutra ] sem abrir'],
    ['só acordes', '[G] [D]   [Em]\n'],
    ['acordes grudados', '[G][D]Letra'],
    ['diretiva com espaços', '{ verso 1 }\n  {refrão}  \n'],
    ['frontmatter vazio', '---\n---\nLetra'],
    ['vazio', ''],
    ['acentos', '[Am]Glória, [F]aleluia! Ação de graças'],
  ])('%s', (_, source) => {
    expect(serializeDocument(parseDocument(source))).toBe(source);
  });
});

describe('parseDocument', () => {
  it('separa frontmatter, seções, comentários e letra', () => {
    const doc = parseDocument('---\ntitle: A\n---\n\n{refrão}\n# nota\n{soc}\n[G]Letra\n');
    expect(doc.frontmatter).toBe('---\ntitle: A\n---\n');
    expect(doc.lines.map((l) => l.kind)).toEqual([
      'lyric',
      'section',
      'raw',
      'raw',
      'lyric',
      'lyric',
    ]);
  });

  it('metadado e início de ambiente não são seção', () => {
    const doc = parseDocument('{title: A}\n{start_of_chorus}\n{verso 1}');
    expect(doc.lines.map((l) => l.kind)).toEqual(['raw', 'raw', 'section']);
    const verso = doc.lines[2]!;
    expect(verso.kind === 'section' && sectionName(verso)).toBe('verso 1');
  });

  it('acha os acordes pela posição na letra', () => {
    expect(parseLyricLine('[G]Por[C]que')).toEqual({
      text: 'Porque',
      chords: [
        { at: 0, chord: 'G' },
        { at: 3, chord: 'C' },
      ],
    });
  });
});

describe('editar a letra', () => {
  const edit = (raw: string, next: string, caret?: number) =>
    text(editLyric(line(raw), next, caret));

  it('corrigir uma palavra não mexe nos acordes de antes', () => {
    expect(edit('[G]Porque Ele [C]vive', 'Porque Ele vive!')).toBe('[G]Porque Ele [C]vive!');
  });

  it('o acorde depois do trecho alterado anda junto com a sílaba', () => {
    expect(edit('Porque [C]vive', 'Porque Ele vive', 11)).toBe('Porque Ele [C]vive');
    expect(edit('Porque Ele [C]vive', 'Porque [C]vive'.replace('[C]', ''), 7)).toBe(
      'Porque [C]vive',
    );
  });

  it('digitar bem na frente do acorde mantém o acorde na sílaba dele', () => {
    expect(edit('[G]Porque', 'OPorque', 1)).toBe('O[G]Porque');
  });

  it('letras repetidas: o cursor diz onde foi a edição', () => {
    // Sem o cursor, parecia ter sido depois do último "a", e o acorde não andaria.
    expect(edit('a[G]a', 'aaa', 1)).toBe('aa[G]a');
  });

  it('apagar o trecho do acorde não apaga o acorde', () => {
    expect(edit('Porque [C]vive sempre', 'Porque sempre', 7)).toBe('Porque [C]sempre');
    expect(edit('[G]Oi [C]tudo', '')).toBe('[G][C]');
  });

  it('trocar a linha inteira mantém todos os acordes, espalhados', () => {
    const result = editLyric(line('[G]Uma [C]duas [D]tres'), 'Quatro cinco seis');
    expect(result.chords.map((c) => c.chord)).toEqual(['G', 'C', 'D']);
    expect(result.chords.map((c) => c.at)).toEqual([0, 5, 12]);
  });

  it('acorde no fim da linha continua no fim', () => {
    expect(edit('Vive[G]', 'Vive sempre', 11)).toBe('Vive sempre[G]');
  });

  it('digitar ou colar [G] no campo vira acorde, sem perder os outros', () => {
    expect(edit('[G]Porque Ele vive', 'Porque Ele [C]vive')).toBe('[G]Porque Ele [C]vive');
  });

  it('colchete sem fechar fica como texto até fechar', () => {
    expect(edit('Porque', 'Por[que', 4)).toBe('Por[que');
  });
});

describe('Enter e juntar linhas', () => {
  it('cada acorde vai com o seu pedaço, sem espaço sobrando', () => {
    const [a, b] = splitLine(line('[G]Porque Ele [C]vive'), 7);
    expect(text(a)).toBe('[G]Porque');
    expect(text(b)).toBe('Ele [C]vive');
  });

  it('Enter no fim cria linha vazia; no começo, empurra tudo', () => {
    const fim = splitLine(line('[G]Letra'), 5);
    expect(text(fim[0])).toBe('[G]Letra');
    expect(text(fim[1])).toBe('');
    const inicio = splitLine(line('[G]Letra'), 0);
    expect(text(inicio[0])).toBe('');
    expect(text(inicio[1])).toBe('[G]Letra');
  });

  it('juntar desfaz o Enter', () => {
    const original = line('[G]Porque Ele [C]vive');
    const [a, b] = splitLine(original, 7);
    expect(text(mergeLines(a, b))).toBe('[G]Porque Ele [C]vive');
  });

  it('juntar com linha vazia não põe espaço', () => {
    expect(text(mergeLines(line(''), line('[G]Letra')))).toBe('[G]Letra');
    expect(text(mergeLines(line('[G]Letra'), line('')))).toBe('[G]Letra');
  });

  it('linhas novas têm identidade própria', () => {
    const original = line('Uma duas');
    const [a, b] = splitLine(original, 4);
    expect(a.id).toBe(original.id);
    expect(b.id).not.toBe(original.id);
  });
});

describe('editar os acordes', () => {
  it('colocar na posição tocada, sem mexer na letra', () => {
    const result = addChord(line('Porque Ele vive'), 7, 'C');
    expect(text(result)).toBe('Porque [C]Ele vive');
    expect(result.text).toBe('Porque Ele vive');
  });

  it('fica em ordem, ainda que seja colocado depois', () => {
    expect(text(addChord(line('Porque [C]Ele'), 0, 'G'))).toBe('[G]Porque [C]Ele');
  });

  it('trocar e remover mexem só naquele acorde', () => {
    const l = line('[G]Por[C]que');
    expect(text(setChord(l, 1, 'Am7'))).toBe('[G]Por[Am7]que');
    expect(text(removeChord(l, 0))).toBe('Por[C]que');
  });

  it('mover para outra posição, passando por cima de outro acorde', () => {
    const moved = moveChord(line('[G]abc[C]def'), 0, 5);
    expect(text(moved.line)).toBe('abc[C]de[G]f');
    expect(moved.index).toBe(1);
  });

  it('um passo para o lado, sem sair da linha', () => {
    expect(text(nudgeChord(line('a[G]bc'), 0, 1).line)).toBe('ab[G]c');
    expect(text(nudgeChord(line('[G]abc'), 0, -1).line)).toBe('[G]abc');
    expect(text(nudgeChord(line('abc[G]'), 0, 1).line)).toBe('abc[G]');
  });

  it('o índice inválido não altera nada', () => {
    const l = line('[G]abc');
    expect(moveChord(l, 5, 0).line).toBe(l);
    expect(nudgeChord(l, 5, 1).line).toBe(l);
  });
});

describe('linha só de acordes', () => {
  it('reconhece, mas não confunde com linha vazia ou com letra', () => {
    expect(isChordOnly(line('[G] [D]'))).toBe(true);
    expect(isChordOnly(line(''))).toBe(false);
    expect(isChordOnly(line('[G]Oi'))).toBe(false);
  });

  it('acrescenta no fim, com um espaço entre eles', () => {
    expect(text(addChord(line('[G] [D]'), 0, 'Em'))).toBe('[G] [D] [Em]');
  });

  it('remover não deixa buraco, e sem acordes vira linha vazia', () => {
    expect(text(removeChord(line('[G] [D] [Em]'), 1))).toBe('[G] [Em]');
    expect(text(removeChord(line('[G]'), 0))).toBe('');
  });

  it('mover é trocar de lugar com o vizinho', () => {
    const moved = nudgeChord(line('[G] [D] [Em]'), 0, 1);
    expect(text(moved.line)).toBe('[D] [G] [Em]');
    expect(moved.index).toBe(1);
    expect(nudgeChord(line('[G] [D]'), 1, 1).index).toBe(1);
  });

  it('continua sendo lida como linha só de acordes pelo app', () => {
    const { song } = parse(text(addChord(line('[G]'), 0, 'D')));
    expect(song.sections.flatMap((s) => s.lines)[0]?.segments.map((s) => s.chord?.raw)).toEqual([
      'G',
      'D',
    ]);
  });
});

describe('o que a tela desenha', () => {
  it('pedaços com o acorde de cada um, sem perder nenhuma letra', () => {
    const segments = lineSegments(line('Ai [G]Por[C]que'));
    expect(segments).toEqual([
      { chordIndex: null, start: 0, text: 'Ai ' },
      { chordIndex: 0, start: 3, text: 'Por' },
      { chordIndex: 1, start: 6, text: 'que' },
    ]);
    expect(segments.map((s) => s.text).join('')).toBe('Ai Porque');
  });

  it('dois acordes juntos, acorde no fim e linha sem acordes', () => {
    expect(lineSegments(line('[G][D]Oi')).map((s) => s.text)).toEqual(['', 'Oi']);
    expect(lineSegments(line('Oi[G]')).map((s) => [s.chordIndex, s.text])).toEqual([
      [null, 'Oi'],
      [0, ''],
    ]);
    expect(lineSegments(line('Oi'))).toEqual([{ chordIndex: null, start: 0, text: 'Oi' }]);
    expect(lineSegments(line(''))).toEqual([{ chordIndex: null, start: 0, text: '' }]);
  });

  it('a linha de acordes alinha com a letra, e o acorde largo empurra o seguinte', () => {
    expect(chordRow(line('[G]Porque Ele [C]vive'))).toBe('G          C');
    expect(chordRow(line('[Bm7(b5)]Oi [C]tudo'))).toBe('Bm7(b5) C');
  });

  it('os acordes mais usados vêm primeiro, sem repetir', () => {
    const doc = parseDocument('[G]a [C]b [G]c\n[D]d [G]e [C]f\n[ ]g');
    expect(usedChords(doc)).toEqual(['G', 'C', 'D']);
  });
});

describe('campos do frontmatter', () => {
  const SOURCE = '---\ntitle: Velho\nartist: \ncategories: [culto, natal]\n---\n\n[G]Letra\n';

  it('lê o valor, sem os colchetes das categorias', () => {
    expect(getField(SOURCE, 'title')).toBe('Velho');
    expect(getField(SOURCE, 'artist')).toBe('');
    expect(getField(SOURCE, 'categories')).toBe('culto, natal');
    expect(getField(SOURCE, 'key')).toBe('');
  });

  it('não lê campo que está na letra, fora do frontmatter', () => {
    expect(getField('[G]Letra\ntitle: Falso\n', 'title')).toBe('');
  });

  it('muda só a linha do campo', () => {
    expect(setField(SOURCE, 'title', 'Novo')).toBe(SOURCE.replace('title: Velho', 'title: Novo'));
  });

  it('cria o campo que falta, no fim do bloco', () => {
    expect(setField(SOURCE, 'key', 'G')).toBe(
      '---\ntitle: Velho\nartist: \ncategories: [culto, natal]\nkey: G\n---\n\n[G]Letra\n',
    );
  });

  it('cria o bloco, se a música não tiver', () => {
    const result = setField('[G]Letra\n', 'title', 'Nova');
    expect(result).toBe('---\ntitle: Nova\n---\n\n[G]Letra\n');
    expect(parse(result).song.metadata.title).toBe('Nova');
  });

  it('categorias voltam com os colchetes, e o app entende', () => {
    const result = setField(SOURCE, 'categories', 'Comunhão, Final');
    expect(result).toContain('categories: [Comunhão, Final]');
    expect(parse(result).song.metadata.categories).toEqual(['Comunhão', 'Final']);
  });

  it('título com sinais especiais não quebra o arquivo', () => {
    const result = setField(SOURCE, 'title', 'Glória: $1 a Deus');
    expect(result).toContain('title: Glória: $1 a Deus\n');
    expect(parse(result).song.metadata.title).toBe('Glória: $1 a Deus');
  });

  it('quebra de linha colada no campo não cria outro campo', () => {
    expect(setField(SOURCE, 'title', 'Uma\nkey: Z')).toContain('title: Uma key: Z\n');
  });

  it('respeita as quebras do Windows', () => {
    const windows = '---\r\ntitle: A\r\n---\r\nLetra\r\n';
    expect(setField(windows, 'title', 'B')).toBe('---\r\ntitle: B\r\n---\r\nLetra\r\n');
    expect(setField(windows, 'key', 'G')).toBe('---\r\ntitle: A\r\nkey: G\r\n---\r\nLetra\r\n');
  });

  it('frontmatter e letra continuam intactos depois de editar uma linha', () => {
    const doc = parseDocument(SOURCE);
    const lines = doc.lines.map((l) =>
      l.kind === 'lyric' && l.text === 'Letra' ? editLyric(l, 'Letra nova') : l,
    );
    expect(serializeDocument({ ...doc, lines })).toBe(SOURCE.replace('Letra', 'Letra nova'));
  });
});
