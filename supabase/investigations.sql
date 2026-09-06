-- Gang Task Force — enquêtes + historique
-- À exécuter APRÈS schema.sql (nécessite public.profiles).
-- Dashboard Supabase → SQL Editor → New query.

-- Fonctions utilitaires : lisent uniquement la ligne "profiles" de
-- l'appelant (autorisée par la policy profiles_select_own), donc aucune
-- élévation de privilège malgré security invoker par défaut.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_active_agent()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and statut = 'actif'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_agent() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- investigations ---------------------------------------------------

create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'cloturee', 'archivee')),
  suspects text not null default '',
  preuves text not null default '',
  description text not null default '',
  agent_responsable text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_investigations_updated_at
before update on public.investigations
for each row execute function public.set_updated_at();

alter table public.investigations enable row level security;

revoke all on public.investigations from anon;
revoke all on public.investigations from authenticated;

grant select, insert on public.investigations to authenticated;
grant update (
  titre, statut, suspects, preuves, description, agent_responsable
) on public.investigations to authenticated;
-- Pas de grant sur created_by / created_at / deleted_at, et pas de DELETE
-- du tout pour authenticated : la corbeille (soft delete via deleted_at),
-- la restauration et la suppression définitive passent exclusivement par
-- le serveur (clé service_role), après vérification applicative
-- (créateur ou admin pour la corbeille, admin seul pour
-- restaurer/supprimer définitivement).

create policy "investigations_select"
  on public.investigations for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

create policy "investigations_insert"
  on public.investigations for insert
  to authenticated
  with check (public.is_active_agent() and created_by = auth.uid());

create policy "investigations_update"
  on public.investigations for update
  to authenticated
  using (deleted_at is null and public.is_active_agent())
  with check (public.is_active_agent());

-- --- investigation_history ---------------------------------------------

create table public.investigation_history (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  agent_id uuid references auth.users (id) on delete set null,
  agent_pseudo text not null,
  resume text not null,
  created_at timestamptz not null default now()
);

alter table public.investigation_history enable row level security;

revoke all on public.investigation_history from anon;
revoke all on public.investigation_history from authenticated;

grant select, insert on public.investigation_history to authenticated;
-- Pas d'update/delete : journal d'audit immuable, même pour un admin
-- via l'application.

create policy "investigation_history_select"
  on public.investigation_history for select
  to authenticated
  using (public.is_active_agent());

create policy "investigation_history_insert"
  on public.investigation_history for insert
  to authenticated
  with check (agent_id = auth.uid() and public.is_active_agent());
