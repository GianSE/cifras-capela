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
    // 4 linhas (2 pares de acorde/letra). O <title> não entra no texto: ele é
    // lido à parte, porque misturado à cifra era descartado como lixo do site.
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('C');
    expect(lines[1]).toContain('Vou seguir com alegria');
  });

  it('junta acorde e letra na posição certa', () => {
    const song = importHtml(CIFRA_HTML);
    expect(song.body).toContain('[C]Vou seguir');
    expect(song.body).toContain('[Am]cada passo');
    expect(song.key).toBe('C');
  });

  it('usa o <title> da página quando não há título no corpo', () => {
    const song = importHtml(CIFRA_HTML);
    expect(song.title).toBe('Alegria no Caminho');
    expect(song.artist).toBe('Domínio Público');
  });
});

describe('tablatura no CifraClub', () => {
  // Estrutura real ("Tu És o Centro", Frei Gilson): a intro em acordes e,
  // logo depois, a tablatura dividida em partes, dentro de `.tabs > .tab`.
  // O botão "ocultar tablaturas" do site só existe no navegador; o HTML que o
  // Worker baixa sempre traz as duas coisas.
  const HTML = `<!doctype html><html><head>
<title>Tu És o Centro - Frei Gilson - Cifra Club</title></head><body>
<pre><div class="kvMV">[Intro] <b data-chord-name="F">F</b>  <b data-chord-name="Dm7">Dm7</b>  <b data-chord-name="Bb">Bb</b>

</div><div class="kvMV"><div class="tabs"><span class="tab">Parte 1 de 2
           <b data-chord-name="F">F</b>                     <b data-chord-name="Dm7">Dm7</b>
E|------------------------------------------|
D|-----3---3h5--5/7-7~-------3---3h5--5/7-7~|
</span>
<span class="tab">Parte 2 de 2
           <b data-chord-name="Bb">Bb</b>                     <b data-chord-name="F">F</b>
E|------------------------------------------|
</span></div>
</div><div class="kvMV">[Primeira Parte]

             <b data-chord-name="F">F</b>
Quero Te louvar
</div></pre></body></html>`;

  it('não traz os rótulos nem os acordes da tablatura', () => {
    const body = importHtml(HTML).body;
    expect(body).not.toMatch(/Parte \d de \d/);
    // Só a intro e o verso: F Dm7 Bb na intro, F no verso — nada da tab.
    expect(body.match(/\[Dm7\]/g) ?? []).toHaveLength(1);
  });

  it('mantém a intro em acordes e a letra', () => {
    const body = importHtml(HTML).body;
    expect(body).toMatch(/\{Intro\}/);
    expect(body).toMatch(/\[F\] \[Dm7\] \[Bb\]/);
    expect(body).toContain('Quero Te louv');
  });
});
