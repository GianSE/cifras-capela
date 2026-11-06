import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PdfPreviewDialog, type PdfChoice } from '../../src/components/playlist/PdfPreviewDialog';
import * as download from '../../src/lib/export/download';

vi.mock('../../src/lib/pdf-render', () => ({
  renderPdfToImages: vi.fn(async (data: ArrayBuffer) =>
    Array.from({ length: new Uint8Array(data)[0]! }, (_, i) => ({
      data: `data:image/jpeg;base64,p${i}`,
      width: 10,
      height: 14,
    })),
  ),
}));

/** O "PDF" de teste guarda no primeiro byte quantas páginas tem. */
function fakePdf(pages: number, filename: string) {
  return { bytes: new Uint8Array([pages]).buffer, filename };
}

describe('prévia do PDF', () => {
  let generate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    generate = vi.fn(async ({ lyricsOnly, toc }: PdfChoice) =>
      fakePdf(lyricsOnly ? 1 : toc ? 3 : 2, lyricsOnly ? 'missa-letra.pdf' : 'missa.pdf'),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const open = () =>
    render(
      <PdfPreviewDialog open onOpenChange={() => {}} title="Missa · Domingo" generate={generate} />,
    );

  it('mostra as páginas do PDF de verdade, com cifras e sumário por padrão', async () => {
    open();
    expect(await screen.findAllByRole('img', { name: /Página \d de 3/ })).toHaveLength(3);
    expect(generate).toHaveBeenLastCalledWith({
      lyricsOnly: false,
      toc: true,
      together: true,
      columns: 1,
      fontScale: 1,
    });
    expect(screen.getByText('3 páginas')).toBeTruthy();
  });

  it('tirar o sumário e trocar para letra refaz a prévia', async () => {
    open();
    await screen.findAllByRole('img', { name: /de 3/ });

    fireEvent.click(screen.getByRole('switch', { name: 'Sumário' }));
    expect(await screen.findAllByRole('img', { name: /de 2/ })).toHaveLength(2);
    expect(generate).toHaveBeenLastCalledWith(
      expect.objectContaining({ lyricsOnly: false, toc: false }),
    );

    fireEvent.click(screen.getByRole('radio', { name: /Só a letra/ }));
    expect(await screen.findAllByRole('img', { name: /de 1/ })).toHaveLength(1);
    expect(generate).toHaveBeenLastCalledWith(
      expect.objectContaining({ lyricsOnly: true, toc: false }),
    );
  });

  it('juntar, duas colunas e tamanho da letra vão para o PDF e ficam lembrados', async () => {
    open();
    await screen.findAllByRole('img', { name: /de 3/ });

    fireEvent.click(screen.getByRole('switch', { name: 'Juntar músicas' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Duas colunas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Letra maior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Letra maior' }));

    await waitFor(() =>
      expect(generate).toHaveBeenLastCalledWith({
        lyricsOnly: false,
        toc: true,
        together: false,
        columns: 2,
        fontScale: 1.2,
      }),
    );
    expect(screen.getByText('Letra 120%')).toBeTruthy();
    cleanup();

    open();
    await screen.findAllByRole('img');
    expect(screen.getByRole('switch', { name: 'Duas colunas' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByText('Letra 120%')).toBeTruthy();
  });

  it('o tamanho da letra tem limites', async () => {
    open();
    await screen.findAllByRole('img', { name: /de 3/ });
    const menor = screen.getByRole('button', { name: 'Letra menor' }) as HTMLButtonElement;
    fireEvent.click(menor);
    fireEvent.click(menor);
    expect(screen.getByText('Letra 80%')).toBeTruthy();
    expect(menor.disabled).toBe(true);
  });

  it('opções guardadas estranhas voltam ao padrão', async () => {
    localStorage.setItem(
      'cifras-capela:pdf-escolha',
      JSON.stringify({ columns: 7, fontScale: 'grande', together: 'sim' }),
    );
    open();
    await screen.findAllByRole('img');
    expect(generate).toHaveBeenLastCalledWith(
      expect.objectContaining({ columns: 1, fontScale: 1, together: true }),
    );
  });

  it('lembra a escolha para a próxima vez', async () => {
    open();
    await screen.findAllByRole('img', { name: /de 3/ });
    fireEvent.click(screen.getByRole('radio', { name: /Só a letra/ }));
    await screen.findAllByRole('img', { name: /de 1/ });
    cleanup();

    open();
    await screen.findAllByRole('img', { name: /de 1/ });
    expect(screen.getByRole('radio', { name: /Só a letra/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('baixa exatamente o arquivo que está na tela', async () => {
    const save = vi.spyOn(download, 'downloadBlob').mockImplementation(() => {});
    open();
    await screen.findAllByRole('img', { name: /de 3/ });
    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/ }));

    const [name, blob] = save.mock.calls[0]!;
    expect(name).toBe('missa.pdf');
    expect(new Uint8Array(await (blob as Blob).arrayBuffer())).toEqual(new Uint8Array([3]));
  });

  it('não deixa baixar enquanto monta, e uma resposta antiga não troca a nova', async () => {
    let finishSlow: (v: ReturnType<typeof fakePdf>) => void = () => {};
    generate.mockImplementationOnce(() => new Promise((resolve) => (finishSlow = resolve)));
    open();
    expect((screen.getByRole('button', { name: /Baixar PDF/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    // Troca a opção antes da primeira terminar.
    fireEvent.click(screen.getByRole('radio', { name: /Só a letra/ }));
    await screen.findAllByRole('img', { name: /de 1/ });

    await act(async () => finishSlow(fakePdf(5, 'velho.pdf')));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
  });

  it('falha ao montar avisa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    generate.mockRejectedValue(new Error('rede'));
    open();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível montar/);
  });
});
