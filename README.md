# 🎵 Minha Biblioteca de Cifras

Biblioteca pessoal de cifras musicais — **rápida, offline, instalável (PWA)**, com
transposição robusta, busca instantânea, favoritos, histórico, modo apresentação,
auto-scroll, editor e importação.

As músicas ficam em **arquivos versionados no Git** (sem banco de dados). Hospedada no
**Cloudflare Pages/Workers**.

---

## ✨ Recursos

- **Transposição robusta** de qualquer acorde (`A`, `Am7`, `F#m7(b5)`, `Bbmaj7`, `G/B`,
  `Eb7(#9)`, `A°`, `Aaug`…), de −11 a +11 semitons, com preferência por sustenidos ♯ ou
  bemóis ♭.
- **Renderizador próprio**: acordes posicionados **acima da letra**.
- **Capotraste**: mostra tom original, tom exibido e a casa sugerida.
- **Busca instantânea** por nome, artista, categoria, tag e **trechos da letra**.
- **Filtros** por categoria (culto, santa ceia, natal, jovens, harpa, corinhos…).
- **Favoritos** e **histórico** (localStorage).
- **Modo apresentação** (tela cheia, fonte grande, alto contraste, tela sempre acesa).
- **Auto-scroll** com velocidade ajustável.
- **Editor** interno com preview ao vivo e **importação** (TXT, MD, HTML, JSON, PDF).
- **PWA offline**: instala no celular e funciona sem internet.
- **Tema claro e escuro**.

---

## 🧱 Stack

- **React 19** + **Vite** + **TypeScript** (strict)
- **TailwindCSS v4** + **shadcn/ui** (Radix)
- **Vitest** (testes) · **oxlint** + **Prettier**
- **vite-plugin-pwa** (Workbox) · **MiniSearch** (busca) · **pdfjs-dist** (import de PDF)
- **Cloudflare Pages + Workers** (deploy)

---

## 📂 Estrutura (monorepo)

```
cifras-capela/
├── frontend/           # App React (PWA)
│   ├── public/songs/   # 🎵 Suas músicas (.cho) + index.json (gerado)
│   ├── scripts/        # build-song-index.ts (gera o índice de busca)
│   └── src/
│       ├── components/ # ui (shadcn), layout, song, library, editor
│       ├── hooks/      # useTranspose, useAutoScroll, useFavorites, useTheme…
│       ├── lib/        # parser, transpose, import, search, storage, export
│       ├── pages/      # Home, Song, Favorites, Editor, Import, Settings
│       └── types/      # modelo de dados (AST)
└── worker/             # Cloudflare Worker (sitemap.xml, headers, futuras APIs)
```

Camadas de domínio reutilizáveis e desacopladas:

- **`lib/transpose`** — biblioteca de transposição reutilizável:
  `transpose("F#m7", -3) // "Ebm7"`.
- **`lib/parser`** — lexer/parser/serializer do formato híbrido (frontmatter + ChordPro).
- **`lib/import`** — importadores desacoplados por formato.

---

## 🚀 Como rodar

Requer **Node 20+**.

```bash
# na raiz do monorepo
npm install

# ambiente de desenvolvimento (http://localhost:5173)
npm run dev

# testes (parser, transposição, renderização)
npm run test

# build de produção (gera o índice + bundle em frontend/dist)
npm run build

# pré-visualizar o build
npm run preview
```

---

## ➕ Como adicionar músicas

1. Crie um arquivo `.cho` em `frontend/public/songs/<coleção>/<slug>.cho`.
2. Use o **formato híbrido** (frontmatter YAML + corpo ChordPro):

```
---
title: Porque Ele Vive
artist: Harpa Cristã
key: G
tempo: 72
categories: [culto, santa ceia]
tags: [clássico]
language: pt
capo: 0
---

{verso 1}
[G]Porque Ele [C]vive
[D]posso crer no ama[G]nhã

{refrão}
[G]Porque Ele [G7]vive
```

3. Rode `npm run build:index` (ou `npm run build`) para atualizar a busca.

### Regras do formato

- **Frontmatter** entre `---`: `title`, `artist`, `key`, `tempo`/`bpm`, `capo`,
  `categories` (lista), `tags` (lista), `language`.
- **Acordes** inline entre colchetes, colados na sílaba: `[G]Por`.
- **Seções** amigáveis: `{verso 1}`, `{refrão}`, `{ponte}`, `{intro}` (auto-fecham).
- Também aceita **ChordPro puro** (`{title: ...}`, `{start_of_verse}`) por compatibilidade.

> Prefira o **editor interno** (menu → Editor) para escrever com preview ao vivo e
> **baixar o `.cho`** pronto.

---

## ☁️ Deploy no Cloudflare

O app é um SPA estático servido pelo **Cloudflare Pages**; o **Worker** adiciona
`sitemap.xml` e headers.

### Opção A — Cloudflare Pages (mais simples)

1. Faça push do repositório para o GitHub.
2. No painel Cloudflare → **Pages** → **Connect to Git**.
3. Configure:
   - **Build command**: `npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/`
4. Deploy. Cada `git push` publica automaticamente.

### Opção B — Worker servindo os assets

```bash
# build do frontend
npm run build

# publicar o Worker (serve frontend/dist + sitemap.xml)
npm run worker:deploy
```

O `worker/wrangler.toml` aponta `assets.directory` para `../frontend/dist` com
fallback SPA. Ajuste `SITE_URL` se quiser URLs absolutas no sitemap.

---

## 🧪 Qualidade

```bash
npm run lint      # oxlint
npm run format    # prettier
npm run test      # vitest
```

Cobertura de testes focada em **parser**, **transposição** e **renderização** — o núcleo
crítico do app.
