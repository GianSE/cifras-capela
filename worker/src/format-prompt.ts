/**
 * Prompt e schema para converter texto bruto de cifra no formato de autoria
 * do app (frontmatter YAML + corpo ChordPro).
 *
 * Usado com a API do Gemini (Google). O schema segue o formato de `responseSchema`
 * do Gemini (tipos em MAIÚSCULO).
 */

export const FORMAT_SYSTEM = `Você converte cifras de músicas em texto bruto (coladas de sites como CifraClub, PDFs ou digitadas) para um formato específico. Responda SOMENTE com o JSON estruturado pedido.

FORMATO DE SAÍDA (campo "source") — frontmatter YAML entre --- seguido do corpo:

---
title: <título>
artist: <artista, ou omita a linha se desconhecido>
key: <tom, ex.: G, Am, F#m; deduza do primeiro/último acorde se não estiver explícito>
tempo: <BPM, só se estiver claro; senão omita a linha>
capo: <casa do capo, só se mencionado; senão omita>
categories: [<1 a 2 entre: culto, santa ceia, natal, jovens, infantil, harpa, corinhos, adoração, louvor>]
tags: []
language: pt
---

{verso 1}
[G]Letra com os acordes [C]colados na sílaba certa
{refrão}
[Em]Outra linha...

REGRAS:
- Acordes ficam INLINE entre colchetes, imediatamente antes da sílaba onde tocam: "[G]Por[C]que".
- Se o texto vier com acordes numa linha ACIMA da letra, alinhe-os inline pela coluna.
- Seções: use {verso 1}, {verso 2}, {refrão}, {ponte}, {intro}, {final}. Reconheça "1ª Estrofe", "Refrão", "Coro", etc.
- NÃO invente acordes. Se a linha não tinha acorde, deixe só a letra.
- Descarte lixo: tablaturas (e|--3--), "Afinação:", links, "x2" solto.
- Preserve a letra fielmente (ortografia, acentos, pontuação).
- title/artist: use os do texto; se ausentes, deduza do começo e registre um aviso.
- Em "warnings", liste em português curto o que ficou incerto (ex.: "Tom deduzido do 1º acorde", "Sem acordes no texto — adicione manualmente", "Título deduzido").`;

/** Schema de saída estruturada (formato Gemini `responseSchema`). */
export const FORMAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    source: {
      type: 'STRING',
      description: 'O arquivo .cho completo (frontmatter + corpo ChordPro).',
    },
    warnings: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Avisos sobre o que ficou incerto na conversão.',
    },
  },
  required: ['source', 'warnings'],
} as const;

export interface FormatResult {
  source: string;
  warnings: string[];
}
