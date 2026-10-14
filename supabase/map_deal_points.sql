-- Gang Task Force — carte interactive : zones de vente sans gang +
-- points de deal.
-- À exécuter APRÈS zones.sql, sensitive_zones_qg.sql, gangs.sql,
-- permissions_unite.sql, unite_etat_major.sql, history_integrity.sql et
-- fk_profiles_harmonize.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.

-- ====================================================================
-- PARTIE 1 — Zone de vente sans gang
-- ====================================================================
-- gang_id devient facultatif, uniquement pour une zone de vente : un QG
-- a TOUJOURS un gang (contrainte CHECK). Les zones existantes ont toutes
-- un gang : elles respectent déjà la contrainte. Permissions, verrous,
-- historique et corbeille des zones ne changent pas.

alter table public.sensitive_zones alter column gang_id drop not null;

alter table public.sensitive_zones
  drop constraint if exists sensitive_zones_qg_requires_gang;
alter table public.sensitive_zones
  add constraint sensitive_zones_qg_requires_gang
  check (gang_id is not null or type_zone = 'vente');

-- ====================================================================
-- PARTIE 2 — Points de deal
-- ====================================================================
-- Même architecture que les marqueurs laboratoire (lab_markers.sql) :
-- lecture pour tout agent actif, écriture ID / GTF / EM / admin, verrou
-- anti-conflit de 3 min, historique dont l'auteur est posé par la base,
-- corbeille via le serveur (service_role), restauration et suppression
-- définitive par l'admin.

-- --- deal_points (table + policies ne référençant pas les verrous) ----

create table if not exists public.deal_points (
  id uuid primary key default gen_random_uuid(),
  produit text not null check (produit in ('cocaine', 'meth', 'weed')),
  statut text not null default 'actif' check (statut in ('actif', 'inactif')),
  -- Organisation (B.D.D.) facultative. Sa suppression définitive retire
  -- seulement le lien : le point reste sur la carte, en gris.
  organisation_id uuid references public.gangs (id) on delete set null,
  note text check (note is null or char_length(note) <= 5000),
  -- Point {x, y} en coordonnées pixel relatives à l'image de carte
  -- (identiques sur les 3 versions, comme les zones et les labos).
  position jsonb not null check (
    jsonb_typeof(position -> 'x') = 'number'
    and jsonb_typeof(position -> 'y') = 'number'
  ),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists deal_points_organisation_id_idx
  on public.deal_points (organisation_id);

drop trigger if exists trg_deal_points_updated_at on public.deal_points;
create trigger trg_deal_points_updated_at
before update on public.deal_points
for each row execute function public.set_updated_at();

alter table public.deal_points enable row level security;

revoke all on public.deal_points from anon;
revoke all on public.deal_points from authenticated;

grant select on public.deal_points to authenticated;
grant insert (produit, statut, organisation_id, note, position, created_by)
  on public.deal_points to authenticated;
grant update (produit, statut, organisation_id, note, position)
  on public.deal_points to authenticated;
-- Pas de grant sur deleted_at ni de DELETE : corbeille par le serveur.

drop policy if exists "deal_points_select" on public.deal_points;
create policy "deal_points_select"
  on public.deal_points for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

drop policy if exists "deal_points_insert" on public.deal_points;
create policy "deal_points_insert"
  on public.deal_points for insert
  to authenticated
  with check (
    public.is_active_agent()
    and created_by = auth.uid()
    and public.unite_peut_ecrire_operationnel()
  );

-- --- deal_point_locks (avant la policy UPDATE qui la référence) -------

create table if not exists public.deal_point_locks (
  point_id uuid primary key references public.deal_points (id) on delete cascade,
  locked_by uuid not null references public.profiles (id) on delete cascade,
  locked_at timestamptz not null default now()
);

alter table public.deal_point_locks enable row level security;

revoke all on public.deal_point_locks from anon;
revoke all on public.deal_point_locks from authenticated;

grant select, delete on public.deal_point_locks to authenticated;
-- Acquisition / renouvellement uniquement via le serveur
-- (app/(app)/zones/deal-actions.ts) ; libération de son propre verrou
-- directement via RLS.

drop policy if exists "deal_point_locks_select" on public.deal_point_locks;
create policy "deal_point_locks_select"
  on public.deal_point_locks for select
  to authenticated
  using (public.is_active_agent());

drop policy if exists "deal_point_locks_delete_own" on public.deal_point_locks;
create policy "deal_point_locks_delete_own"
  on public.deal_point_locks for delete
  to authenticated
  using (locked_by = auth.uid());

-- --- deal_points : policy UPDATE (bloquée si verrouillé par un autre) --

drop policy if exists "deal_points_update" on public.deal_points;
create policy "deal_points_update"
  on public.deal_points for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
    and not exists (
      select 1 from public.deal_point_locks
      where deal_point_locks.point_id = deal_points.id
        and deal_point_locks.locked_by <> auth.uid()
        and deal_point_locks.locked_at > now() - interval '3 minutes'
    )
  )
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

-- --- deal_point_history ------------------------------------------------

create table if not exists public.deal_point_history (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.deal_points (id) on delete cascade,
  agent_id uuid references public.profiles (id) on delete set null,
  agent_pseudo text not null,
  resume text not null,
  created_at timestamptz not null default now()
);

create index if not exists deal_point_history_point_id_idx
  on public.deal_point_history (point_id, created_at);

alter table public.deal_point_history enable row level security;

revoke all on public.deal_point_history from anon;
revoke all on public.deal_point_history from authenticated;

grant select, insert on public.deal_point_history to authenticated;

-- Auteur posé par la base depuis la session (history_integrity.sql).
drop trigger if exists trg_deal_point_history_author on public.deal_point_history;
create trigger trg_deal_point_history_author
before insert on public.deal_point_history
for each row execute function public.set_history_author();

drop policy if exists "deal_point_history_select" on public.deal_point_history;
create policy "deal_point_history_select"
  on public.deal_point_history for select
  to authenticated
  using (public.is_active_agent());

drop policy if exists "deal_point_history_insert" on public.deal_point_history;
create policy "deal_point_history_insert"
  on public.deal_point_history for insert
  to authenticated
  with check (
    agent_id = auth.uid()
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );
