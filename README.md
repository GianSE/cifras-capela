# 🎵 Minha Biblioteca de Cifras

Biblioteca pessoal de cifras musicais — **rápida, offline, instalável (PWA)**, com
transposição robusta, busca instantânea, playlists (setlists), histórico, modo
apresentação, auto-scroll, editor e importação.

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
- **Playlists (setlists)**: monte o repertório do dia, **arraste os cards** para ordenar
  (funciona no toque), passe as músicas no app com Anterior/Próxima e **exporte tudo num
  PDF único** (com índice e uma música por página).
- **Histórico** das músicas abertas recentemente (localStorage).
- **Modo apresentação** (tela cheia, fonte grande, alto contraste, tela sempre acesa).
- **Auto-scroll** com velocidade ajustável.
- **Editor** interno com preview ao vivo, **exportação em PDF** e **importação**
  (TXT, MD, HTML, JSON, PDF).
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

## 🗄️ Onde as músicas ficam (dois modos)

O app funciona de dois jeitos, escolhidos automaticamente pela presença das
credenciais do Supabase:

| | **Modo estático** (padrão) | **Modo Supabase** |
|---|---|---|
| Fonte da verdade | arquivos `.cho` no Git | tabela `songs` no Postgres |
| Criar/editar/excluir no app | ❌ somente leitura | ✅ CRUD completo |
| Sincroniza celular ↔ PC | via commit + deploy | ✅ na hora |
| Ler offline | ✅ (service worker) | ✅ (cache local) |
| Precisa de login | — | só para **escrever** |

### Ativando o modo Supabase (CRUD)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra [`supabase/schema.sql`](supabase/schema.sql), **troque `SEU-EMAIL-AQUI@exemplo.com`
   pelo seu e-mail**, e execute o arquivo inteiro no **SQL Editor**. Isso cria a tabela
   `songs`, a lista de `editors` e as políticas de RLS.
3. **Project Settings → API**: copie a *Project URL* (`https://xxxx.supabase.co` — **não**
   a URL do painel) e a chave *anon public* (ou *Publishable key*).
4. Copie `frontend/.env.example` para `frontend/.env.local` e preencha:
   ```bash
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
5. **Crie seu usuário**: Authentication → Users → **Add user** → o mesmo e-mail do passo 2,
   com uma senha, e marque *Auto Confirm User*.
6. **Suba as músicas que já estão no Git** (uma vez só):
   ```bash
   npm run seed:sql --workspace=frontend   # gera supabase/seed.sql
   ```
   Cole o `supabase/seed.sql` no SQL Editor e execute. (É idempotente — rodar de novo só
   atualiza. Usa o SQL Editor em vez da API justamente para nenhuma chave secreta
   precisar sair do painel.)
7. Reinicie o `npm run dev`. Em **/config → Conta**, entre com e-mail e senha. Pronto:
   os botões **Salvar** e **Excluir** aparecem no editor e no importador.

### Segurança — por que a lista de `editors`

A anon key **vai no bundle do app** (é pública por design), então quem protege a escrita é
o RLS. Só exigir "autenticado" **não basta**: o cadastro público do Supabase vem ligado por
padrão, e qualquer pessoa poderia criar uma conta e editar sua biblioteca. Por isso as
policies checam a tabela `editors` — mesmo com cadastro aberto, só os e-mails de lá
escrevem. Leitura é pública (ninguém precisa entrar para ver as cifras).

> Reforço opcional: Authentication → Providers → Email → desligue *Enable sign ups*.

> No deploy do Cloudflare Pages, defina `VITE_SUPABASE_URL` e
> `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente do projeto.

---

## ➕ Como adicionar músicas

**Com o Supabase ativo:** use o **Editor** (menu → Editor) ou o **Importar**, e
clique em **Salvar**. A música aparece na hora em todos os seus dispositivos.

**No modo estático**, crie o arquivo à mão:

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

### Importar do CifraClub e afins

O **/importar** já converte automaticamente o formato "acordes acima da letra"
(como o CifraClub mostra): cole o texto, ele reconhece seções (Intro/Refrão),
deduz o tom pelo 1º acorde e descarta lixo (tablatura, links). Para importar
várias de uma vez, separe-as com uma linha de `---`.

---

## 🤖 Formatar com IA (opcional)

Um botão **"Formatar com IA"** no /importar usa o **Gemini (Google)** para limpar
e formatar textos bagunçados (PDF exportado, cópia torta) em ChordPro. A chamada
acontece **no Worker** — a chave da API é um *secret* e **nunca** vai ao navegador.
Sem a chave configurada, o botão simplesmente não aparece.

**Pegue a chave** (grátis) em <https://aistudio.google.com/apikey> — ela começa
com `AIza...`. Nunca cole a chave em código, chat ou commit; ela só entra como
secret.

Para ativar no site publicado:

```bash
# 1. Configure a chave como secret do Worker (não vai para o Git nem o bundle)
cd worker && npx wrangler secret put GEMINI_API_KEY   # cole a chave quando pedir

# 2. Publique
npm run build --workspace=frontend
npm run worker:deploy
```

Para testar localmente com `wrangler dev`, crie `worker/.dev.vars` (já ignorado
pelo Git) com:

```
GEMINI_API_KEY=AIza...
```

- Modelo padrão: `gemini-2.0-flash` (constante `MODEL` em `worker/src/index.ts`),
  rápido e com free tier generoso.
- A IA **não inventa acordes**: se o texto não tinha cifra, ela formata só a letra
  e avisa. Sempre há uma tela de revisão antes de salvar.
- Como o Worker é quem chama o Gemini, a IA funciona no site publicado (ou em
  `wrangler dev`), não no `npm run dev` (que roda só o Vite).

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
