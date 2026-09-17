# 🎵 Minha Biblioteca de Cifras

Biblioteca pessoal de cifras musicais — **rápida, offline, instalável (PWA)**, com
transposição robusta, busca instantânea, playlists (setlists), histórico, modo
apresentação, auto-scroll, editor e importação.

As músicas ficam num banco **D1**, cadastradas pelo próprio app (Editor ou Importar).
Hospedada no **Cloudflare Workers**.

---

## ✨ Recursos

- **Transposição robusta** de qualquer acorde (`A`, `Am7`, `F#m7(b5)`, `Bbmaj7`, `G/B`,
  `Eb7(#9)`, `A°`, `Aaug`…), de −11 a +11 semitons, com preferência por sustenidos ♯ ou
  bemóis ♭.
- **Renderizador próprio**: acordes posicionados **acima da letra**.
- **Capotraste**: mostra tom original, tom exibido e a casa sugerida.
- **Busca instantânea** por nome, artista, categoria, tag e **trechos da letra**.
- **Filtros** por categoria (culto, santa ceia, natal, jovens, harpa, corinhos…).
- **Playlists (setlists)**: monte o repertório do dia, **arraste os cards** para ordenar
  (funciona no toque), passe as músicas no app com Anterior/Próxima e **exporte tudo num
  PDF único** (com índice e uma música por página).
- **Histórico** das músicas abertas recentemente (localStorage).
- **Modo apresentação** (tela cheia, fonte grande, alto contraste, tela sempre acesa).
- **Vídeo da música** (YouTube): vem sozinho ao importar do CifraClub ou colando o link;
  toca nos cards da biblioteca e da playlist, e dentro da música fica num player
  acoplado para ouvir enquanto lê a cifra.
- **Playlist compartilhada**: um toggle libera o link para quem entrar como convidado.
- **Auto-scroll** com velocidade ajustável.
- **Editor** interno com preview ao vivo, **exportação em PDF** e **importação**
  (link do CifraClub e afins, PDF, `.cho` e foto JPG/PNG).
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
│   └── src/
│       ├── components/ # ui (shadcn), layout, song, library, editor
│       ├── hooks/      # useTranspose, useAutoScroll, useFavorites, useTheme…
│       ├── lib/        # parser, transpose, import, search, storage, export
│       ├── pages/      # Home, Song, Favorites, Editor, Import, Settings
│       └── types/      # modelo de dados (AST)
└── worker/             # Cloudflare Worker (API, login, D1, sitemap.xml, headers)
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

# build de produção (bundle em frontend/dist)
npm run build

# pré-visualizar o build
npm run preview
```

---

## 🗄️ Onde as músicas ficam

A biblioteca mora num banco **D1** (SQLite da Cloudflare), servido pelo próprio
Worker em `/api/*` — mesma origem do site, sem serviço externo. Ler é público;
criar, editar e excluir exigem login.

Não há músicas de exemplo nem carga inicial: a biblioteca começa vazia e só tem o
que for salvo pelo app. Se o banco não responder, a leitura cai para a **cópia local**
— a última lista bem-sucedida, com as cifras inteiras. Sem rede e sem cópia, a tela
avisa que não conseguiu carregar.

### Login

JWT (HS256) num cookie **httpOnly**, assinado pelo Worker — o JavaScript da página
não alcança o token. Senhas em PBKDF2-SHA256. Não há cadastro pelo site: quem edita
é criado por SQL.

**Criar ou trocar a senha de um administrador** (a senha não sai da sua máquina, o
script só gera o hash):

```powershell
cd worker
$SQL = node scripts/criar-admin.mjs "voce@exemplo.com" "Seu Nome" "sua-senha"
npx wrangler d1 execute cifras-db --remote --command $SQL
```

Sem `--remote`, o usuário vai para o banco local de desenvolvimento, não para o site.

### Configuração (uma vez só)

Já feita neste projeto — fica registrada para recriar do zero:

```bash
cd worker
npx wrangler d1 create cifras-db            # cole o database_id no wrangler.toml
npx wrangler d1 migrations apply cifras-db --remote
npx wrangler secret put JWT_SECRET          # um valor aleatório longo
```

Para desenvolver localmente, crie `worker/.dev.vars` com `JWT_SECRET=...` e
`APP_ENV=development`, e aplique as migrações com `--local` em vez de `--remote`.

---

## ➕ Como adicionar músicas

Entre com sua conta, use o **Editor** (menu → Editor) ou o **Importar**, e clique em
**Salvar**. A música vai para o D1 e aparece na hora em todos os seus dispositivos.

No Editor, a cifra é escrita no **formato híbrido** (frontmatter YAML + corpo ChordPro):

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

### Regras do formato

- **Frontmatter** entre `---`: `title`, `artist`, `key`, `tempo`/`bpm`, `capo`,
  `categories` (lista), `tags` (lista), `language`.
- **Acordes** inline entre colchetes, colados na sílaba: `[G]Por`.
- **Seções** amigáveis: `{verso 1}`, `{refrão}`, `{ponte}`, `{intro}` (auto-fecham).
- Também aceita **ChordPro puro** (`{title: ...}`, `{start_of_verse}`) por compatibilidade.

> Prefira o **editor interno** (menu → Editor) para escrever com preview ao vivo e
> **baixar o `.cho`** pronto.

### Importar do CifraClub e afins

O **/importar** aceita o **link** da página (CifraClub e afins) ou um **arquivo**
`.pdf`, `.cho`, `.jpg` ou `.png`. O formato "acordes acima da letra" vira
inline automaticamente: ele reconhece seções (Intro/Refrão), lê ou deduz o tom e
descarta lixo (tablatura, links). Tudo passa por uma revisão antes de salvar.

---

## ☁️ Deploy no Cloudflare

O **Worker** serve o SPA (`frontend/dist`), a API com o D1, o login e o `sitemap.xml`
(gerado a partir das músicas do banco).

```bash
# build do frontend
npm run build

# publicar o Worker
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
