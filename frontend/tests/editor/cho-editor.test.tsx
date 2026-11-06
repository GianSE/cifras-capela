import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ChoEditor, type EditorMode } from '../../src/components/editor/ChoEditor';

const MODE_KEY = 'cifras-capela:editor-modo';

const SOURCE = `---
title: Teste
key: G
---

{verso 1}
[G]Porque Ele [C]vive
Eu posso crer

{intro}
[G] [D]
`;

/** Guarda o texto como a tela de verdade faz, e expõe o último valor. */
function Harness({ initial, fields }: { initial: string; fields?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ChoEditor
        value={value}
        onChange={setValue}
        showFields={fields ?? false}
        codeEditor={
          <textarea aria-label="código" value={value} onChange={(e) => setValue(e.target.value)} />
        }
      />
      <pre data-testid="fonte">{value}</pre>
    </>
  );
}

const source = () => screen.getByTestId('fonte').textContent;
const open = (mode: EditorMode, initial = SOURCE, fields?: boolean) => {
  localStorage.setItem(MODE_KEY, mode);
  render(<Harness initial={initial} {...(fields !== undefined && { fields })} />);
};
const lyric = (text: string) => screen.getByRole('textbox', { name: `Linha: ${text}` });

/** Digita como o navegador: troca o valor, com o cursor no lugar da edição. */
function type(input: HTMLElement, value: string, caret = value.length) {
  const el = input as HTMLInputElement;
  // O React lê a seleção durante o `change`, então ela precisa vir junto.
  const original = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'selectionStart')!;
  Object.defineProperty(el, 'selectionStart', { configurable: true, get: () => caret });
  fireEvent.change(el, { target: { value } });
  Object.defineProperty(el, 'selectionStart', original);
}

/** Toca na letra da posição indicada, entre todas as letras visíveis da linha. */
function touchLetter(container: HTMLElement, text: string, at: number) {
  const letter = Array.from(container.querySelectorAll<HTMLElement>('[data-at]')).filter(
    (el) => el.dataset.at === String(at),
  );
  // Linhas diferentes têm posições iguais: acha a da frase pedida.
  const inLine = letter.find((el) =>
    el
      .closest('.flex-wrap')
      ?.textContent?.replace(/[A-G]m?\s*/g, '')
      .includes(text.slice(0, 3)),
  );
  fireEvent.click(inLine ?? letter[0]!);
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('modos', () => {
  it('começa no modo fácil, na Letra', () => {
    render(<Harness initial={SOURCE} />);
    expect(screen.getByRole('radio', { name: /Letra/ }).getAttribute('aria-checked')).toBe('true');
    expect(lyric('Porque Ele vive')).toBeTruthy();
  });

  it('lembra o último modo usado', () => {
    open('acordes');
    expect(screen.getByRole('radio', { name: /Acordes/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: /Letra/ }));
    expect(localStorage.getItem(MODE_KEY)).toBe('letra');
  });

  it('o modo .cho mostra o texto cru, com [G]', () => {
    render(<Harness initial={SOURCE} />);
    fireEvent.click(screen.getByRole('radio', { name: /\.cho/ }));
    const code = screen.getByRole('textbox', { name: 'código' }) as HTMLTextAreaElement;
    expect(code.value).toContain('[G]Porque Ele [C]vive');
  });

  it('o que se digita no .cho aparece na Letra', () => {
    open('codigo');
    fireEvent.change(screen.getByRole('textbox', { name: 'código' }), {
      target: { value: '[G]Nova letra' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Letra/ }));
    expect(lyric('Nova letra')).toBeTruthy();
  });

  it('abrir e passar pelos modos sem mexer não altera o arquivo', () => {
    const onChange = vi.fn();
    render(<ChoEditor value={SOURCE} onChange={onChange} codeEditor={<textarea />} />);
    fireEvent.click(screen.getByRole('radio', { name: /Acordes/ }));
    fireEvent.click(screen.getByRole('radio', { name: /\.cho/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Letra/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('modo Letra', () => {
  it('corrigir a letra não tira os acordes do lugar', () => {
    open('letra');
    type(lyric('Porque Ele vive'), 'Porque Ele vive!');
    expect(source()).toContain('[G]Porque Ele [C]vive!\n');
  });

  it('o acorde anda junto com a sílaba, e o resto do arquivo fica igual', () => {
    open('letra');
    type(lyric('Porque Ele vive'), 'Porque Jesus vive', 12);
    expect(source()).toBe(SOURCE.replace('[G]Porque Ele [C]vive', '[G]Porque Jesus [C]vive'));
  });

  it('mostra os acordes em cima, sem deixar editar por engano', () => {
    open('letra');
    const row = lyric('Porque Ele vive').previousElementSibling!;
    expect(row.textContent).toBe('G          C');
    expect(row.getAttribute('aria-hidden')).toBe('true');
  });

  it('Enter parte a linha no cursor, levando cada acorde com o seu pedaço', () => {
    open('letra');
    const input = lyric('Porque Ele vive') as HTMLInputElement;
    input.setSelectionRange(7, 7);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(source()).toContain('[G]Porque\nEle [C]vive\n');
    expect(document.activeElement).toBe(lyric('Ele vive'));
  });

  it('Backspace no começo junta com a linha de cima', () => {
    open('letra');
    const input = lyric('Eu posso crer') as HTMLInputElement;
    input.setSelectionRange(0, 0);
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(source()).toContain('[G]Porque Ele [C]vive Eu posso crer\n');
  });

  it('Backspace no meio da linha é só apagar uma letra', () => {
    open('letra');
    const input = lyric('Eu posso crer') as HTMLInputElement;
    input.setSelectionRange(3, 3);
    expect(fireEvent.keyDown(input, { key: 'Backspace' })).toBe(true);
    expect(source()).toBe(SOURCE);
  });

  it('colar várias linhas cria várias linhas', () => {
    open('letra');
    const input = lyric('Eu posso crer') as HTMLInputElement;
    input.setSelectionRange(13, 13);
    fireEvent.paste(input, {
      clipboardData: { getData: () => '\nno amanhã\n[Am]sem temer' },
    });
    expect(source()).toContain('Eu posso crer\nno amanhã\n[Am]sem temer\n');
  });

  it('a linha só de acordes aparece, mas não vira campo de letra', () => {
    open('letra');
    expect(screen.getByTitle(/Linha só de acordes/).textContent).toBe('G  D');
  });

  it('excluir uma linha', () => {
    open('letra');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir a linha: Eu posso crer' }));
    expect(source()).not.toContain('Eu posso crer');
    expect(source()).toContain('[G]Porque Ele [C]vive');
  });

  it('renomear e remover o título de uma parte, sem perder a letra', () => {
    open('letra');
    fireEvent.change(screen.getByDisplayValue('verso 1'), { target: { value: 'refrão' } });
    expect(source()).toContain('{refrão}\n[G]Porque');
    fireEvent.click(screen.getByRole('button', { name: 'Remover o título refrão' }));
    expect(source()).not.toContain('{refrão}');
    expect(source()).toContain('[G]Porque Ele [C]vive');
  });

  it('acrescentar uma parte no fim do arquivo', () => {
    open('letra');
    fireEvent.click(screen.getByRole('button', { name: 'Ponte' }));
    expect(source()).toMatch(/\[G\] \[D\]\n\n\{ponte\}\n\n$/);
  });

  it('Desfazer volta o que foi feito, e digitar seguido é um passo só', () => {
    open('letra');
    const undo = screen.getByRole('button', { name: /Desfazer/ }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);

    type(lyric('Eu posso crer'), 'Eu posso cre');
    type(lyric('Eu posso cre'), 'Eu posso cr');
    expect(undo.disabled).toBe(false);
    fireEvent.click(undo);
    expect(source()).toBe(SOURCE);
    expect(undo.disabled).toBe(true);
  });

  it('Ctrl+Z desfaz', () => {
    open('letra');
    type(lyric('Eu posso crer'), 'Mudou');
    fireEvent.keyDown(lyric('Mudou'), { key: 'z', ctrlKey: true });
    expect(source()).toBe(SOURCE);
  });
});

describe('modo Acordes', () => {
  const bar = (name: string) => screen.getByRole('group', { name });
  const LINE = 'Eu posso crer';

  /** Toca numa letra da linha sem acordes do arquivo. */
  const touch = (at: number) => touchLetter(document.body, LINE, at);

  it('tocar numa letra e escolher um acorde das sugestões: a letra não muda', () => {
    open('acordes', '---\nkey: G\n---\nEu posso crer\n');
    touch(3);
    fireEvent.click(within(bar('Novo acorde')).getByRole('button', { name: 'Em' }));
    expect(source()).toBe('---\nkey: G\n---\nEu [Em]posso crer\n');
    // A barra fecha: o próximo toque já é em outro lugar.
    expect(screen.queryByRole('group', { name: 'Novo acorde' })).toBeNull();
  });

  it('também dá para digitar o acorde', () => {
    open('acordes', 'Eu posso crer');
    touch(0);
    const field = within(bar('Novo acorde')).getByRole('textbox', { name: 'Acorde' });
    fireEvent.change(field, { target: { value: 'Am7' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(source()).toBe('[Am7]Eu posso crer');
  });

  it('avisa do acorde que o app não reconhece, mas deixa usar', () => {
    open('acordes', 'Eu posso crer');
    touch(0);
    const field = within(bar('Novo acorde')).getByRole('textbox', { name: 'Acorde' });
    fireEvent.change(field, { target: { value: 'Xyz' } });
    expect(screen.getByText(/não reconhece este acorde/)).toBeTruthy();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(source()).toBe('[Xyz]Eu posso crer');
  });

  it('as setas ajustam a letra marcada antes de escolher o acorde', () => {
    open('acordes', 'Eu posso crer');
    touch(3);
    fireEvent.click(screen.getByRole('button', { name: 'Mover para a direita' }));
    const field = within(bar('Novo acorde')).getByRole('textbox', { name: 'Acorde' });
    fireEvent.change(field, { target: { value: 'G' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(source()).toBe('Eu p[G]osso crer');
  });

  it('sem acrescentar linhas aqui: a letra não muda neste modo', () => {
    open('acordes');
    expect(screen.queryByRole('button', { name: 'Linha' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ponte' })).toBeNull();
  });

  it('fechar sem escolher não acrescenta nada', () => {
    open('acordes', 'Eu posso crer');
    touch(0);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(source()).toBe('Eu posso crer');
  });

  it('as sugestões trazem os acordes da música e o campo harmônico', () => {
    open('acordes', '---\nkey: G\n---\n[F#m7]Eu posso crer\n');
    touch(3);
    const names = within(bar('Novo acorde'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names[0]).toBe('F#m7');
    expect(names).toContain('Em');
  });

  it('tocar num acorde: trocar', () => {
    open('acordes');
    fireEvent.click(screen.getAllByRole('button', { name: 'Acorde C' })[0]!);
    const field = within(bar('Editar acorde')).getByRole('textbox', { name: 'Acorde' });
    expect((field as HTMLInputElement).value).toBe('C');
    fireEvent.change(field, { target: { value: 'Am' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(source()).toContain('[G]Porque Ele [Am]vive');
  });

  it('tocar num acorde: mover um passo, sem fechar a barra', () => {
    open('acordes');
    fireEvent.click(screen.getByRole('button', { name: 'Acorde C' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover para a direita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover para a direita' }));
    expect(source()).toContain('[G]Porque Ele vi[C]ve');
    expect(screen.getByRole('group', { name: 'Editar acorde' })).toBeTruthy();
  });

  it('tocar num acorde e depois numa letra da mesma linha: move para lá', () => {
    open('acordes', '[C]Eu posso crer');
    fireEvent.click(screen.getByRole('button', { name: 'Acorde C' }));
    touch(3);
    expect(source()).toBe('Eu [C]posso crer');
  });

  it('tocar num acorde: remover', () => {
    open('acordes');
    fireEvent.click(screen.getByRole('button', { name: 'Acorde C' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover o acorde' }));
    expect(source()).toContain('[G]Porque Ele vive');
  });

  it('acorde no fim da linha, pelo botão', () => {
    open('acordes', 'Eu posso crer');
    fireEvent.click(screen.getByRole('button', { name: 'Colocar acorde no fim da linha' }));
    const field = within(bar('Novo acorde')).getByRole('textbox', { name: 'Acorde' });
    fireEvent.change(field, { target: { value: 'G' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(source()).toBe('Eu posso crer[G]');
  });

  it('linha só de acordes: acrescentar e trocar de lugar', () => {
    open('acordes', '[G] [D]');
    fireEvent.click(screen.getByRole('button', { name: 'Acrescentar acorde' }));
    const field = within(bar('Novo acorde')).getByRole('textbox', { name: 'Acorde' });
    fireEvent.change(field, { target: { value: 'Em' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(source()).toBe('[G] [D] [Em]');

    fireEvent.click(screen.getByRole('button', { name: 'Acorde G' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mover para a direita' }));
    expect(source()).toBe('[D] [G] [Em]');
  });

  it('a letra não vira campo de texto aqui', () => {
    open('acordes');
    expect(screen.queryByRole('textbox', { name: /Linha:/ })).toBeNull();
  });
});

describe('dados da música', () => {
  it('muda só a linha do campo, e a cifra continua igual', () => {
    open('letra', SOURCE, true);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Novo título' } });
    expect(source()).toBe(SOURCE.replace('title: Teste', 'title: Novo título'));
  });

  it('o Tom alimenta as sugestões de acorde', () => {
    open('acordes', '---\nkey: G\n---\nEu posso crer\n', true);
    fireEvent.change(screen.getByLabelText('Tom'), { target: { value: 'Am' } });
    expect(source()).toContain('key: Am');
    touchLetter(document.body, 'Eu posso crer', 0);
    expect(
      within(screen.getByRole('group', { name: 'Novo acorde' })).getByRole('button', {
        name: 'Dm',
      }),
    ).toBeTruthy();
  });

  it('numa música existente vêm recolhidos; numa nova, abertos', () => {
    const { unmount } = render(
      <ChoEditor value={SOURCE} onChange={() => {}} codeEditor={null} showFields />,
    );
    expect(screen.getByText('Dados da música').closest('details')?.open).toBe(false);
    unmount();
    render(
      <ChoEditor value={SOURCE} onChange={() => {}} codeEditor={null} showFields fieldsOpen />,
    );
    expect(screen.getByText('Dados da música').closest('details')?.open).toBe(true);
  });

  it('fica fora quando só se edita o corpo', () => {
    open('letra', SOURCE, false);
    expect(screen.queryByLabelText('Título')).toBeNull();
  });
});
