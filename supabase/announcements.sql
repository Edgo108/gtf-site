-- Gang Task Force — notifications / annonces
-- À exécuter APRÈS schema.sql et investigations.sql (réutilise
-- public.is_admin(), public.is_active_agent(), public.set_updated_at()).
-- Dashboard Supabase → SQL Editor → New query.

-- Seuls les grades Lieutenant / Capitaine / Commandant peuvent créer une
-- annonce (le Capitaine a les mêmes droits que le Commandant).
-- Lit uniquement la ligne "profiles" de l'appelant (autorisée par
-- profiles_select_own), donc aucune élévation de privilège.
create or replace function public.can_create_announcements()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and grade in ('Lieutenant', 'Capitaine', 'Commandant')
  );
$$;

grant execute on function public.can_create_announcements() to authenticated;

-- --- announcements -------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  message text not null default '',
  priorite text not null default 'normale' check (priorite in ('normale', 'urgente')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

revoke all on public.announcements from anon;
revoke all on public.announcements from authenticated;

grant select, insert, delete on public.announcements to authenticated;
grant update (titre, message, priorite) on public.announcements to authenticated;

create policy "announcements_select"
  on public.announcements for select
  to authenticated
  using (public.is_active_agent());

create policy "announcements_insert"
  on public.announcements for insert
  to authenticated
  with check (
    public.is_active_agent()
    and public.can_create_announcements()
    and created_by = auth.uid()
  );

create policy "announcements_update"
  on public.announcements for update
  to authenticated
  using (
    public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
  )
  with check (
    public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
  );

create policy "announcements_delete"
  on public.announcements for delete
  to authenticated
  using (
    public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
  );

-- --- announcement_reads ---------------------------------------------------

create table public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

alter table public.announcement_reads enable row level security;

revoke all on public.announcement_reads from anon;
revoke all on public.announcement_reads from authenticated;

grant select, insert on public.announcement_reads to authenticated;
-- Pas d'update/delete : une lecture est un fait immuable, pour soi
-- uniquement (jamais pour le compte d'un autre agent).

create policy "announcement_reads_select_own"
  on public.announcement_reads for select
  to authenticated
  using (user_id = auth.uid());

create policy "announcement_reads_insert_own"
  on public.announcement_reads for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_active_agent());
