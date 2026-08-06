-- =============================================================================
-- Minha Biblioteca de Cifras — schema do Supabase
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma vez.
-- (Painel do projeto → SQL Editor → New query → colar → Run)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela de músicas
--
-- `source` é a fonte da verdade: o arquivo .cho completo (frontmatter + corpo).
-- As demais colunas são metadados **derivados** do source, gravados pelo app
-- para permitir listar e buscar sem precisar parsear tudo no cliente.
-- -----------------------------------------------------------------------------
create table if not exists public.songs (
  -- Slug com "pasta", igual aos arquivos: 'harpa-crista/porque-ele-vive'
  id          text primary key,
  title       text not null,
  artist      text,
  -- "key" é palavra reservada em SQL; guardamos como song_key
  song_key    text,
  tempo       integer,
  capo        integer,
  categories  text[] not null default '{}',
  tags        text[] not null default '{}',
  language    text,
  -- Letra em texto puro (sem acordes) — usada só para busca
  lyrics      text,
  -- O arquivo .cho completo
  source      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Busca e ordenação
create index if not exists songs_title_idx on public.songs (title);
create index if not exists songs_categories_idx on public.songs using gin (categories);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Quem pode editar
--
-- Não basta exigir "autenticado": o cadastro público do Supabase vem ligado
-- por padrão, então qualquer pessoa poderia criar uma conta e escrever. Esta
-- tabela é a lista explícita de quem tem permissão — mesmo que o cadastro
-- fique aberto, só estes e-mails editam.
--
-- >>> TROQUE PELO SEU E-MAIL ANTES DE EXECUTAR <<<
-- -----------------------------------------------------------------------------
create table if not exists public.editors (
  email text primary key
);

insert into public.editors (email) values
  ('gianpedrodev@gmail.com')
on conflict (email) do nothing;

-- A tabela é privada: sem policy de SELECT, ninguém a lê pelo app.
alter table public.editors enable row level security;

/**
 * `security definer` permite que a função consulte `editors` mesmo com o RLS
 * ativo — é assim que as policies abaixo conseguem checar a lista.
 */
create or replace function public.is_editor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.editors where email = (auth.jwt() ->> 'email')
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security das músicas
--
-- A anon key fica embutida no bundle do app (é pública por design), então a
-- segurança tem que estar aqui: qualquer um pode LER, mas só os e-mails
-- listados em `editors` podem escrever.
-- -----------------------------------------------------------------------------
alter table public.songs enable row level security;

drop policy if exists "songs: leitura pública" on public.songs;
create policy "songs: leitura pública"
  on public.songs for select
  using (true);

drop policy if exists "songs: inserir autenticado" on public.songs;
drop policy if exists "songs: inserir editor" on public.songs;
create policy "songs: inserir editor"
  on public.songs for insert
  to authenticated
  with check (public.is_editor());

drop policy if exists "songs: atualizar autenticado" on public.songs;
drop policy if exists "songs: atualizar editor" on public.songs;
create policy "songs: atualizar editor"
  on public.songs for update
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists "songs: excluir autenticado" on public.songs;
drop policy if exists "songs: excluir editor" on public.songs;
create policy "songs: excluir editor"
  on public.songs for delete
  to authenticated
  using (public.is_editor());

-- -----------------------------------------------------------------------------
-- Playlists (setlists) — sincronizadas entre dispositivos para quem loga.
--
-- Cada usuário só enxerga e mexe nas suas próprias playlists (não há
-- compartilhamento). Diferente de `songs`, aqui não passa pela lista de
-- `editors`: qualquer conta autenticada pode ter as suas.
--
-- `id` é gerado no cliente (mesmo formato do localStorage), não pelo banco —
-- assim o app cria uma playlist e já sabe o id na hora, sem round-trip.
-- -----------------------------------------------------------------------------
create table if not exists public.playlists (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  song_ids    text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists playlists_user_id_idx on public.playlists (user_id);

drop trigger if exists playlists_set_updated_at on public.playlists;
create trigger playlists_set_updated_at
  before update on public.playlists
  for each row execute function public.set_updated_at();

alter table public.playlists enable row level security;

drop policy if exists "playlists: dono lê" on public.playlists;
create policy "playlists: dono lê"
  on public.playlists for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "playlists: dono insere" on public.playlists;
create policy "playlists: dono insere"
  on public.playlists for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "playlists: dono atualiza" on public.playlists;
create policy "playlists: dono atualiza"
  on public.playlists for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "playlists: dono exclui" on public.playlists;
create policy "playlists: dono exclui"
  on public.playlists for delete
  to authenticated
  using (user_id = auth.uid());
