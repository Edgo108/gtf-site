-- Gang Task Force — Dispatch (prise de service, unités Alpha→Zulu,
-- rôle de dispatcheur exclusif)
-- À exécuter APRÈS schema.sql et investigations.sql (réutilise
-- public.is_active_agent(), public.is_admin(), public.set_updated_at()).
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Toutes les règles sont appliquées en base (RLS + triggers), l'interface
-- ne fait que les refléter :
--   - lecture de tout le dispatch : agent actif ;
--   - « Prendre son service » : un agent crée SA ligne agent_status, en
--     attente de dispatch, sans unité ;
--   - un agent change son propre statut seulement s'il n'est plus en
--     attente, et seulement entre disponible / occupe / en_intervention,
--     sans toucher à son unité ;
--   - le dispatcheur actif (et l'admin) modifie statut + unité de tout
--     agent ;
--   - catégorie de patrouille d'une unité : dispatcheur actif, admin, ou
--     agent affecté à cette unité.

-- ====================================================================
-- 1. Tables
-- ====================================================================

create table if not exists public.dispatch_units (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  categorie_patrouille text
    check (categorie_patrouille in ('patrouille', 'henry', 'marry', 'gnd', 'cid', 'em')),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_dispatch_units_updated_at on public.dispatch_units;
create trigger trg_dispatch_units_updated_at
before update on public.dispatch_units
for each row execute function public.set_updated_at();

-- Les 26 unités fixes (alphabet OTAN : l'ordre alphabétique des noms est
-- aussi l'ordre Alpha → Zulu).
insert into public.dispatch_units (nom)
values
  ('Alpha'), ('Bravo'), ('Charlie'), ('Delta'), ('Echo'), ('Foxtrot'),
  ('Golf'), ('Hotel'), ('India'), ('Juliett'), ('Kilo'), ('Lima'),
  ('Mike'), ('November'), ('Oscar'), ('Papa'), ('Quebec'), ('Romeo'),
  ('Sierra'), ('Tango'), ('Uniform'), ('Victor'), ('Whiskey'), ('X-ray'),
  ('Yankee'), ('Zulu')
on conflict (nom) do nothing;

create table if not exists public.agent_status (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null unique references public.profiles (id) on delete cascade,
  statut text not null default 'en_attente_dispatch'
    check (statut in ('en_attente_dispatch', 'disponible', 'occupe', 'en_intervention')),
  unite_id uuid references public.dispatch_units (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- Rôle de dispatcheur : une seule ligne possible (index unique sur une
-- constante). `last_active_at` = dernière activité du dispatcheur ; passé
-- DISPATCH_TIMEOUT (10 min, cf. is_active_dispatcher), le rôle est
-- considéré libre et peut être repris par un autre agent.
create table if not exists public.dispatch_role (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  taken_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create unique index if not exists dispatch_role_single
  on public.dispatch_role ((true));

-- ====================================================================
-- 2. Fonctions utilitaires
-- ====================================================================

-- L'appelant est-il le dispatcheur actif (rôle détenu et non expiré) ?
create or replace function public.is_active_dispatcher()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_active_agent() and exists (
    select 1 from public.dispatch_role r
    where r.agent_id = auth.uid()
      and r.last_active_at > now() - interval '10 minutes'
  );
$$;

grant execute on function public.is_active_dispatcher() to authenticated;

-- Garde-fou agent_status (en plus des policies) :
--   - agent_id immuable ;
--   - un agent non privilégié ne change jamais d'unité lui-même ;
--   - affecté à une unité alors qu'il était en attente → passe
--     automatiquement « disponible » ;
--   - updated_at / updated_by renseignés par la base, pas par le client.
-- Le service_role (auth.uid() null) n'est pas contraint.
create or replace function public.agent_status_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then
      if new.agent_id <> old.agent_id then
        raise exception 'agent_id non modifiable';
      end if;

      if not (public.is_admin() or public.is_active_dispatcher()) then
        if new.unite_id is distinct from old.unite_id then
          raise exception 'Seul le dispatcheur peut changer l''unité d''un agent.';
        end if;
      end if;

      if old.statut = 'en_attente_dispatch'
         and new.statut = 'en_attente_dispatch'
         and new.unite_id is not null
         and new.unite_id is distinct from old.unite_id then
        new.statut := 'disponible';
      end if;
    end if;

    new.updated_by := auth.uid();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_agent_status_guard on public.agent_status;
create trigger trg_agent_status_guard
before insert or update on public.agent_status
for each row execute function public.agent_status_guard();

-- ====================================================================
-- 3. RLS — dispatch_units
-- ====================================================================

alter table public.dispatch_units enable row level security;

revoke all on public.dispatch_units from anon;
revoke all on public.dispatch_units from authenticated;

grant select on public.dispatch_units to authenticated;
-- Seule la catégorie est modifiable ; pas d'insert/delete (unités fixes).
grant update (categorie_patrouille) on public.dispatch_units to authenticated;

drop policy if exists "dispatch_units_select" on public.dispatch_units;
create policy "dispatch_units_select"
  on public.dispatch_units for select
  to authenticated
  using (public.is_active_agent());

drop policy if exists "dispatch_units_update" on public.dispatch_units;
create policy "dispatch_units_update"
  on public.dispatch_units for update
  to authenticated
  using (
    public.is_active_agent()
    and (
      public.is_admin()
      or public.is_active_dispatcher()
      or exists (
        select 1 from public.agent_status s
        where s.agent_id = auth.uid() and s.unite_id = dispatch_units.id
      )
    )
  )
  with check (public.is_active_agent());

-- ====================================================================
-- 4. RLS — agent_status
-- ====================================================================

alter table public.agent_status enable row level security;

revoke all on public.agent_status from anon;
revoke all on public.agent_status from authenticated;

grant select, delete on public.agent_status to authenticated;
grant insert (agent_id, statut, unite_id) on public.agent_status to authenticated;
grant update (statut, unite_id) on public.agent_status to authenticated;

drop policy if exists "agent_status_select" on public.agent_status;
create policy "agent_status_select"
  on public.agent_status for select
  to authenticated
  using (public.is_active_agent());

-- « Prendre son service » : uniquement pour soi, en attente, sans unité.
drop policy if exists "agent_status_insert" on public.agent_status;
create policy "agent_status_insert"
  on public.agent_status for insert
  to authenticated
  with check (
    public.is_active_agent()
    and agent_id = auth.uid()
    and statut = 'en_attente_dispatch'
    and unite_id is null
  );

-- USING : ligne de départ. Un agent ne touche à la sienne que s'il n'est
-- plus en attente. WITH CHECK : ligne d'arrivée. Un agent ne peut se
-- placer que sur disponible / occupe / en_intervention.
drop policy if exists "agent_status_update" on public.agent_status;
create policy "agent_status_update"
  on public.agent_status for update
  to authenticated
  using (
    public.is_active_agent()
    and (
      public.is_admin()
      or public.is_active_dispatcher()
      or (agent_id = auth.uid() and statut <> 'en_attente_dispatch')
    )
  )
  with check (
    public.is_active_agent()
    and (
      public.is_admin()
      or public.is_active_dispatcher()
      or (
        agent_id = auth.uid()
        and statut in ('disponible', 'occupe', 'en_intervention')
      )
    )
  );

-- Fin de service (suppression de la ligne = remise à zéro) : soi-même, le
-- dispatcheur actif ou l'admin.
drop policy if exists "agent_status_delete" on public.agent_status;
create policy "agent_status_delete"
  on public.agent_status for delete
  to authenticated
  using (
    public.is_active_agent()
    and (
      agent_id = auth.uid()
      or public.is_admin()
      or public.is_active_dispatcher()
    )
  );

-- ====================================================================
-- 5. RLS — dispatch_role
-- ====================================================================

alter table public.dispatch_role enable row level security;

revoke all on public.dispatch_role from anon;
revoke all on public.dispatch_role from authenticated;

grant select, delete on public.dispatch_role to authenticated;
grant insert (agent_id) on public.dispatch_role to authenticated;
-- Renouvellement d'activité uniquement.
grant update (last_active_at) on public.dispatch_role to authenticated;

drop policy if exists "dispatch_role_select" on public.dispatch_role;
create policy "dispatch_role_select"
  on public.dispatch_role for select
  to authenticated
  using (public.is_active_agent());

-- Prise du rôle : pour soi. L'index unique dispatch_role_single refuse la
-- prise si quelqu'un détient déjà le rôle (erreur 23505 gérée par l'UI).
drop policy if exists "dispatch_role_insert" on public.dispatch_role;
create policy "dispatch_role_insert"
  on public.dispatch_role for insert
  to authenticated
  with check (public.is_active_agent() and agent_id = auth.uid());

drop policy if exists "dispatch_role_update" on public.dispatch_role;
create policy "dispatch_role_update"
  on public.dispatch_role for update
  to authenticated
  using (public.is_active_agent() and agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- Libération : le détenteur (« Lâcher le dispatch »), l'admin, ou
-- n'importe quel agent actif si le rôle a expiré par inactivité.
drop policy if exists "dispatch_role_delete" on public.dispatch_role;
create policy "dispatch_role_delete"
  on public.dispatch_role for delete
  to authenticated
  using (
    public.is_active_agent()
    and (
      agent_id = auth.uid()
      or public.is_admin()
      or last_active_at <= now() - interval '10 minutes'
    )
  );

-- ====================================================================
-- 6. Realtime
-- ====================================================================
-- Les changements sont diffusés aux clients abonnés (filtrés par la RLS
-- SELECT ci-dessus).

do $$
declare
  t text;
begin
  foreach t in array array['agent_status', 'dispatch_units', 'dispatch_role'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
