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
    expect(generate).toHaveBeenLastCalledWith({ lyricsOnly: false, toc: true });
    expect(screen.getByText('3 páginas')).toBeTruthy();
  });

  it('tirar o sumário e trocar para letra refaz a prévia', async () => {
    open();
    await screen.findAllByRole('img', { name: /de 3/ });

    fireEvent.click(screen.getByRole('switch'));
    expect(await screen.findAllByRole('img', { name: /de 2/ })).toHaveLength(2);
    expect(generate).toHaveBeenLastCalledWith({ lyricsOnly: false, toc: false });

    fireEvent.click(screen.getByRole('radio', { name: /Só a letra/ }));
    expect(await screen.findAllByRole('img', { name: /de 1/ })).toHaveLength(1);
    expect(generate).toHaveBeenLastCalledWith({ lyricsOnly: true, toc: false });
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
