-- Gang Task Force — marqueurs « Laboratoire » sur la carte interactive
-- À exécuter APRÈS schema.sql, investigations.sql, gangs.sql et
-- permissions_unite.sql (réutilise public.is_active_agent(),
-- public.is_admin(), public.set_updated_at(),
-- public.unite_peut_ecrire_operationnel()).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Même architecture que sensitive_zones (zones.sql) : soft-delete via
-- corbeille, historique dénormalisé, verrou temporaire anti-conflit 3 min.
-- Ré-exécutable sans casser (if not exists + drop ... if exists).

-- --- lab_markers (table + policies ne référençant pas lab_marker_locks) --

create table if not exists public.lab_markers (
  id uuid primary key default gen_random_uuid(),
  categorie text not null check (categorie in ('arme', 'cocaine', 'meth')),
  statut text not null default 'actif' check (statut in ('actif', 'raided')),
  -- Organisation (Gang / MC / Orga) propriétaire du labo.
  organisation_id uuid not null references public.gangs (id) on delete cascade,
  -- Point {x, y} en coordonnées pixel relatives à l'image de carte
  -- (identiques sur les 3 versions, comme pour sensitive_zones).
  position jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_lab_markers_updated_at on public.lab_markers;
create trigger trg_lab_markers_updated_at
before update on public.lab_markers
for each row execute function public.set_updated_at();

alter table public.lab_markers enable row level security;

revoke all on public.lab_markers from anon;
revoke all on public.lab_markers from authenticated;

grant select, insert on public.lab_markers to authenticated;
grant update (categorie, statut, organisation_id, position)
  on public.lab_markers to authenticated;
-- Pas de grant sur deleted_at ni de DELETE : la corbeille (soft delete,
-- restauration, suppression définitive) passe par le serveur
-- (service_role) ; restauration/suppression définitive réservées à l'admin.

-- Lecture : tout agent actif (SASP et DOJ inclus, en lecture seule).
drop policy if exists "lab_markers_select" on public.lab_markers;
create policy "lab_markers_select"
  on public.lab_markers for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

-- Écriture : uniquement ID / GTF (via unite_peut_ecrire_operationnel,
-- qui renvoie aussi true pour l'admin — super-droits conservés).
drop policy if exists "lab_markers_insert" on public.lab_markers;
create policy "lab_markers_insert"
  on public.lab_markers for insert
  to authenticated
  with check (
    public.is_active_agent()
    and created_by = auth.uid()
    and public.unite_peut_ecrire_operationnel()
  );

-- --- lab_marker_locks (avant la policy UPDATE de lab_markers) ------------

create table if not exists public.lab_marker_locks (
  marker_id uuid primary key references public.lab_markers (id) on delete cascade,
  locked_by uuid not null references auth.users (id) on delete cascade,
  locked_at timestamptz not null default now()
);

alter table public.lab_marker_locks enable row level security;

revoke all on public.lab_marker_locks from anon;
revoke all on public.lab_marker_locks from authenticated;

grant select, delete on public.lab_marker_locks to authenticated;
-- Acquisition / renouvellement du verrou uniquement via le serveur
-- (voir app/(app)/zones/lab-actions.ts). Libération de son propre verrou
-- accessible directement via RLS.

drop policy if exists "lab_marker_locks_select" on public.lab_marker_locks;
create policy "lab_marker_locks_select"
  on public.lab_marker_locks for select
  to authenticated
  using (public.is_active_agent());

drop policy if exists "lab_marker_locks_delete_own" on public.lab_marker_locks;
create policy "lab_marker_locks_delete_own"
  on public.lab_marker_locks for delete
  to authenticated
  using (locked_by = auth.uid());

-- --- lab_markers : policy UPDATE (référence lab_marker_locks) -----------
-- Modification bloquée si le marqueur est verrouillé depuis moins de
-- 3 minutes par un AUTRE agent (pas seulement côté UI).

drop policy if exists "lab_markers_update" on public.lab_markers;
create policy "lab_markers_update"
  on public.lab_markers for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
    and not exists (
      select 1 from public.lab_marker_locks
      where lab_marker_locks.marker_id = lab_markers.id
        and lab_marker_locks.locked_by <> auth.uid()
        and lab_marker_locks.locked_at > now() - interval '3 minutes'
    )
  )
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

-- --- lab_marker_history ------------------------------------------------

create table if not exists public.lab_marker_history (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references public.lab_markers (id) on delete cascade,
  agent_id uuid references auth.users (id) on delete set null,
  agent_pseudo text not null,
  resume text not null,
  created_at timestamptz not null default now()
);

alter table public.lab_marker_history enable row level security;

revoke all on public.lab_marker_history from anon;
revoke all on public.lab_marker_history from authenticated;

grant select, insert on public.lab_marker_history to authenticated;

drop policy if exists "lab_marker_history_select" on public.lab_marker_history;
create policy "lab_marker_history_select"
  on public.lab_marker_history for select
  to authenticated
  using (public.is_active_agent());

drop policy if exists "lab_marker_history_insert" on public.lab_marker_history;
create policy "lab_marker_history_insert"
  on public.lab_marker_history for insert
  to authenticated
  with check (agent_id = auth.uid() and public.is_active_agent());
