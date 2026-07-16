-- =============================================================================
-- Seed gerado automaticamente a partir de frontend/public/songs/*.cho
-- NÃO edite à mão: rode `npm run seed:sql --workspace=frontend`
--
-- Cole este arquivo no SQL Editor do Supabase e execute.
-- É idempotente: rodar de novo apenas atualiza as músicas existentes.
-- =============================================================================

insert into public.songs
  (id, title, artist, song_key, tempo, capo, categories, tags, language, lyrics, source)
values
  ('corinhos/alegria-no-caminho', 'Alegria no Caminho', 'Domínio Público', 'C', 120, null, array['corinhos', 'jovens']::text[], array['alegre', 'animado']::text[], 'pt', 'Vou seguir com alegria no caminho, cada passo é uma nova canção. Mesmo quando o vento sopra contra, guardo a paz aqui no coração. Canta, canta, minha alma, a esperança não se vai. Canta, canta, minha alma, nova aurora sempre vem.', '---
title: Alegria no Caminho
artist: Domínio Público
key: C
tempo: 120
categories: [corinhos, jovens]
tags: [alegre, animado]
language: pt
---

{verso 1}
[C]Vou seguir com ale[F]gria no cami[G]nho,
[C]cada passo é uma [F]nova can[G]ção.
[Am]Mesmo quando o vento [F]sopra contra,
[C]guardo a paz aqui no [G]cora[C]ção.

{refrão}
[F]Canta, canta, minha [C]alma,
[G]a esperança não se [Am]vai.
[F]Canta, canta, minha [C]alma,
[G]nova aurora sempre [C]vem.
'),
  ('culto/maos-ao-alto', 'Mãos ao Alto', 'Domínio Público', 'D', 72, null, array['culto', 'santa ceia']::text[], array['adoração', 'lento']::text[], 'pt', 'Ergo minhas mãos ao alto, entrego a Ti meu coração. No silêncio deste encontro, encho-me da Tua paz. Santo, santo, santo, digno de toda adoração. A Ti, Senhor, meu louvor, em cada dia, cada hora. A Ti, Senhor, meu louvor, agora e sempre meu.', '---
title: Mãos ao Alto
artist: Domínio Público
key: D
tempo: 72
categories: [culto, santa ceia]
tags: [adoração, lento]
language: pt
---

{verso 1}
[D]Ergo minhas mãos ao [G]alto,
[A]entrego a Ti meu [D]coração.
[Bm]No silêncio deste [G]encontro,
[A]encho-me da Tua [D]paz.

{ponte}
[G]Santo, [A]santo, [D]santo,
[G]digno de toda [A]adoração.

{refrão}
[D]A Ti, Senhor, meu [A]louvor,
[Bm]em cada dia, [G]cada hora.
[D]A Ti, Senhor, meu [A]louvor,
[G]agora e sem[A]pre [D]meu.
'),
  ('harpa-crista/grandioso-es-tu', 'Grandioso És Tu', 'Harpa Cristã', 'A', null, null, array['hinos']::text[], '{}'::text[], null, 'Senhor meu Deus, quando eu maravilhado Fico a pensar nas obras de Tuas mãos No céu azul de estrelas pontilhado O Teu poder, mostrando a criação Então min''alma canta a Ti, Senhor Grandioso és Tu, grandioso és Tu Então min''alma canta a Ti, Senhor Grandioso és Tu, grandioso és Tu!', '{title: Grandioso És Tu}
{artist: Harpa Cristã}
{key: A}
{category: Hinos}

{start_of_verse: Verso 1}
Se[A]nhor meu Deus, [A7]quando eu mara[D]vilhado
Fico a pen[A]sar nas [E7]obras de Tuas [A]mãos [E7]
No [A]céu azul [A7]de estrelas ponti[D]lhado
O Teu po[A]der, mos[E7]trando a cri[A]ação [E7]
{end_of_verse}

{start_of_chorus}
Então min''[A]alma canta a [D]Ti, Se[A]nhor
[Bm]Grandio[E7]so és [A]Tu, gran[E7]dioso és [A]Tu [E7]
Então min''[A]alma canta a [D]Ti, Se[A]nhor
[Bm]Grandio[E7]so és [A]Tu, gran[E7]dioso és [A]Tu!
{end_of_chorus}
'),
  ('harpa-crista/porque-ele-vive', 'Porque Ele Vive', 'Harpa Cristã', 'G', 72, null, array['hinos']::text[], '{}'::text[], null, 'Deus enviou Seu Filho amado Para perdoar, para me salvar Na cruz morreu por meu pecado Mas ressurgiu e vivo com o Pai está Porque Ele vive Posso crer no amanhã Porque Ele vive Temor não há Mas eu bem sei, eu sei Que a minha vida Está nas mãos do meu Jesus Que vivo está', '{title: Porque Ele Vive}
{artist: Harpa Cristã}
{key: G}
{tempo: 72}
{category: Hinos}

{start_of_verse: Verso 1}
[G]Deus enviou [C]Seu Filho [G]amado
Para per[Em]doar, [A7]para me sal[D]var [D7]
Na [G]cruz mor[G7]reu por [C]meu peca[Cm]do
Mas ressurgiu [G/D]e vivo [D]com o Pai es[G]tá [C/D]
{end_of_verse}

{start_of_chorus}
[G]Porque Ele [G7]vive
Posso [C]crer no a[Cm]manhã
Porque Ele [G/D]vive
[Em]Temor não [A7]há [D]
Mas eu bem [G]sei, [G7]eu sei
Que a minha [C]vida [Cm]
Está nas [G/D]mãos do [Em]meu Je[Am]sus [D7]
Que vivo es[G]tá
{end_of_chorus}
'),
  ('natal/estrela-da-manha', 'Estrela da Manhã', 'Domínio Público', 'G', 84, 2, array['natal', 'culto']::text[], array['natal', 'adoração']::text[], 'pt', 'Brilha no céu a estrela da manhã, anunciando um novo dia a chegar. Sobre o vale desceu tão suave a luz, guiando os passos para encontrar. Glória, glória nas alturas, paz na terra a florescer. Glória, glória nas alturas, hoje o amor veio nascer.', '---
title: Estrela da Manhã
artist: Domínio Público
key: G
tempo: 84
capo: 2
categories: [natal, culto]
tags: [natal, adoração]
language: pt
---

{verso 1}
[G]Brilha no céu a es[C]trela da man[G]hã,
[Em]anunciando um novo [D]dia a chegar.
[G]Sobre o vale desceu [C]tão suave a [G]luz,
[C]guiando os passos [D]para en[G]contrar.

{refrão}
[C]Glória, glória nas al[G]turas,
[Am]paz na terra a [D]florescer.
[C]Glória, glória nas al[G]turas,
[D]hoje o amor veio [G]nascer.
')
on conflict (id) do update set
  title      = excluded.title,
  artist     = excluded.artist,
  song_key   = excluded.song_key,
  tempo      = excluded.tempo,
  capo       = excluded.capo,
  categories = excluded.categories,
  tags       = excluded.tags,
  language   = excluded.language,
  lyrics     = excluded.lyrics,
  source     = excluded.source;
