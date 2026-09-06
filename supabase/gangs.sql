-- Gang Task Force — base de données gangs
-- À exécuter APRÈS schema.sql et investigations.sql (réutilise
-- public.is_active_agent(), public.is_admin(), public.set_updated_at()).
-- Dashboard Supabase → SQL Editor → New query.

-- --- gangs -----------------------------------------------------------

create table public.gangs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  territoire text not null default '',
  niveau_menace text not null default 'moyen' check (niveau_menace in ('faible', 'moyen', 'eleve')),
  activites text not null default '',
  couleur text not null default '#3E6FA6' check (couleur ~ '^#[0-9a-fA-F]{6}$'),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_gangs_updated_at
before update on public.gangs
for each row execute function public.set_updated_at();

alter table public.gangs enable row level security;

revoke all on public.gangs from anon;
revoke all on public.gangs from authenticated;

grant select, insert on public.gangs to authenticated;
grant update (
  nom, territoire, niveau_menace, activites, couleur, notes
) on public.gangs to authenticated;
-- Pas de grant sur deleted_at, ni de DELETE : la corbeille (soft delete,
-- restauration, suppression définitive) passe par le serveur
-- (service_role). Le soft delete est accessible à tout agent actif ;
-- restauration et suppression définitive sont réservées à l'admin
-- (vérifié applicativement dans les Server Actions correspondantes).

create policy "gangs_select"
  on public.gangs for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

create policy "gangs_insert"
  on public.gangs for insert
  to authenticated
  with check (public.is_active_agent());

create policy "gangs_update"
  on public.gangs for update
  to authenticated
  using (deleted_at is null and public.is_active_agent())
  with check (public.is_active_agent());

-- --- gang_members -------------------------------------------------------
-- Suppression simple et directe (pas de corbeille), ouverte à tout agent
-- actif : gérée entièrement par RLS, pas besoin de service_role ici.

create table public.gang_members (
  id uuid primary key default gen_random_uuid(),
  gang_id uuid not null references public.gangs (id) on delete cascade,
  nom text not null,
  role text not null default '',
  statut text not null default 'actif' check (statut in ('actif', 'arrete', 'recherche', 'decede')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_gang_members_updated_at
before update on public.gang_members
for each row execute function public.set_updated_at();

alter table public.gang_members enable row level security;

revoke all on public.gang_members from anon;
revoke all on public.gang_members from authenticated;

grant select, insert, update, delete on public.gang_members to authenticated;

create policy "gang_members_select"
  on public.gang_members for select
  to authenticated
  using (public.is_active_agent());

create policy "gang_members_insert"
  on public.gang_members for insert
  to authenticated
  with check (public.is_active_agent());

create policy "gang_members_update"
  on public.gang_members for update
  to authenticated
  using (public.is_active_agent())
  with check (public.is_active_agent());

create policy "gang_members_delete"
  on public.gang_members for delete
  to authenticated
  using (public.is_active_agent());
