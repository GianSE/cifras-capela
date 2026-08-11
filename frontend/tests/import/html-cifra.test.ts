import { describe, it, expect } from 'vitest';
import { htmlToText, importHtml } from '../../src/lib/import/html-importer';

/**
 * Estrutura que os sites de cifra usam de verdade (verificado numa página do
 * CifraClub): um `<pre>` com um `<div>` por linha e os acordes em `<b>`.
 *
 * O que importa aqui é a quebra de linha vir do `\n` literal antes de cada
 * `</div>` — é dela que depende o alinhamento acorde/letra. Se o site trocar
 * isso por `<br>` ou tirar o `\n`, a cifra chega numa linha só e este teste
 * quebra antes do usuário descobrir.
 */
const CIFRA_HTML = `<!doctype html>
<html><head><title>Alegria no Caminho - Domínio Público</title></head>
<body>
<pre class="_crVx" data-chord-content="true"><div class="k"><b data-chord-name="C">C</b>              <b data-chord-name="F">F</b>
</div><div class="k">Vou seguir com alegria no caminho,
</div><div class="k"><b data-chord-name="Am">Am</b>          <b data-chord-name="G">G</b>
</div><div class="k">cada passo é uma nova canção.
</div></pre>
</body></html>`;

describe('importar cifra de página HTML', () => {
  it('preserva uma linha por linha da cifra', () => {
    const text = htmlToText(CIFRA_HTML);
    const lines = text.split('\n').filter((l) => l.trim());
    // Título + 4 linhas (2 pares de acorde/letra).
    expect(lines).toHaveLength(5);
    expect(lines[1]).toContain('C');
    expect(lines[2]).toContain('Vou seguir com alegria');
  });

  it('junta acorde e letra na posição certa', () => {
    const song = importHtml(CIFRA_HTML);
    expect(song.body).toContain('[C]Vou seguir');
    expect(song.body).toContain('[Am]cada passo');
    expect(song.key).toBe('C');
  });

  it('usa o <title> da página quando não há título no corpo', () => {
    expect(htmlToText(CIFRA_HTML).split('\n')[0]).toContain('Alegria no Caminho');
  });
});
