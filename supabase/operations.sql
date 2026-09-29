-- Gang Task Force — Opérations
-- À exécuter APRÈS schema.sql, investigations.sql, wanted_notices.sql,
-- gangs.sql, zones.sql, lab_markers.sql et permissions_unite.sql (réutilise
-- public.is_admin(), public.is_active_agent(), public.set_updated_at(),
-- public.mon_unite(), et référence investigations / wanted_notices /
-- lab_markers / sensitive_zones / gangs pour les tables de liaison).
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Modèle de permissions PROPRE à cette section (différent de la matrice
-- par unité des autres sections) : l'accès en écriture se décide LIGNE PAR
-- LIGNE (le lead d'une opération + les agents qu'il ajoute dans
-- operation_writers), pas par unité. La seule règle liée à l'unité est un
-- verrou total pour le DOJ : aucun accès, ni liste ni détail, quelle que
-- soit l'implication de l'agent sur l'opération. L'admin garde l'accès
-- complet partout, comme sur le reste du site.

-- ====================================================================
-- 1. Tables
-- ====================================================================

create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text not null default '',
  statut text not null default 'en_cours' check (statut in ('en_cours', 'cloturee', 'archivee')),
  lead_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_operations_updated_at on public.operations;
create trigger trg_operations_updated_at
before update on public.operations
for each row execute function public.set_updated_at();

-- Agents ajoutés en écriture par le lead, en plus du lead lui-même.
create table if not exists public.operation_writers (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (operation_id, agent_id)
);

-- Tables de liaison many-to-many : une opération peut être liée à
-- plusieurs éléments de chaque type, et un élément peut être lié à
-- plusieurs opérations.

create table if not exists public.operation_investigations (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (operation_id, investigation_id)
);

create table if not exists public.operation_wanted_notices (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  wanted_notice_id uuid not null references public.wanted_notices (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (operation_id, wanted_notice_id)
);

create table if not exists public.operation_lab_markers (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  lab_marker_id uuid not null references public.lab_markers (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (operation_id, lab_marker_id)
);

create table if not exists public.operation_zones (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  zone_id uuid not null references public.sensitive_zones (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (operation_id, zone_id)
);

create table if not exists public.operation_gangs (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  gang_id uuid not null references public.gangs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (operation_id, gang_id)
);

-- ====================================================================
-- 2. Fonctions utilitaires RLS
-- ====================================================================
-- Définies APRÈS les deux tables qu'elles interrogent (operations +
-- operation_writers), pour que la validation à la création trouve bien
-- les objets référencés.

-- L'appelant est-il le lead de cette opération ?
create or replace function public.is_operation_lead(target_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.operations o
    where o.id = target_id and o.lead_id = auth.uid()
  );
$$;

-- Accès complet (lecture détaillée + écriture) à une opération donnée :
-- admin, OU (agent actif non-DOJ qui est lead ou agent en écriture de
-- cette opération précise). Le DOJ est bloqué même s'il apparaissait par
-- erreur en lead/écriture — verrou total voulu pour cette unité.
create or replace function public.can_access_operation(target_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    public.is_active_agent()
    and (
      public.is_admin()
      or (
        public.mon_unite() <> 'DOJ'
        and (
          public.is_operation_lead(target_id)
          or exists (
            select 1 from public.operation_writers w
            where w.operation_id = target_id and w.agent_id = auth.uid()
          )
        )
      )
    );
$$;

grant execute on function public.is_operation_lead(uuid) to authenticated;
grant execute on function public.can_access_operation(uuid) to authenticated;

-- ====================================================================
-- 3. RLS — operations
-- ====================================================================
-- Note importante : cette policy SELECT ne couvre QUE l'accès au détail
-- complet (admin / lead / agent en écriture). La liste résumée visible à
-- tout agent non-DOJ (titre, statut, pseudo du lead uniquement) n'est PAS
-- exposée via cette table : elle est construite côté serveur avec la clé
-- service_role, qui sélectionne explicitement ces seules colonnes — même
-- principe que la résolution de pseudo d'un autre agent ailleurs sur le
-- site (RLS de `profiles` restreinte à sa propre ligne).

alter table public.operations enable row level security;

revoke all on public.operations from anon;
revoke all on public.operations from authenticated;

grant select, insert, delete on public.operations to authenticated;
grant update (titre, description, statut) on public.operations to authenticated;
-- Pas de grant sur lead_id : le lead est fixé à la création et ne se
-- transfère pas depuis l'interface.

drop policy if exists "operations_select" on public.operations;
create policy "operations_select"
  on public.operations for select
  to authenticated
  using (public.can_access_operation(id));

drop policy if exists "operations_insert" on public.operations;
create policy "operations_insert"
  on public.operations for insert
  to authenticated
  with check (
    public.is_active_agent()
    and (public.is_admin() or public.mon_unite() <> 'DOJ')
    and lead_id = auth.uid()
  );

-- Modification des champs (titre/description/statut) : lead ET agents en
-- écriture ont exactement les mêmes droits ici.
drop policy if exists "operations_update" on public.operations;
create policy "operations_update"
  on public.operations for update
  to authenticated
  using (public.can_access_operation(id))
  with check (public.can_access_operation(id));

-- Suppression de l'opération : même règle — lead ET agents en écriture
-- peuvent supprimer (seule la gestion de LA LISTE des agents en écriture
-- est réservée au lead, voir operation_writers plus bas).
drop policy if exists "operations_delete" on public.operations;
create policy "operations_delete"
  on public.operations for delete
  to authenticated
  using (public.can_access_operation(id));

-- ====================================================================
-- 4. RLS — operation_writers
-- ====================================================================
-- NUANCE DE PERMISSIONS : un agent en écriture a les mêmes droits que le
-- lead sur l'opération (voir policies operations_update/delete ci-dessus)
-- SAUF gérer cette liste elle-même. Seul le lead (ou l'admin) peut
-- ajouter/retirer un agent en écriture — d'où des policies INSERT/DELETE
-- volontairement plus strictes que can_access_operation().

alter table public.operation_writers enable row level security;

revoke all on public.operation_writers from anon;
revoke all on public.operation_writers from authenticated;

grant select, insert, delete on public.operation_writers to authenticated;
-- Pas d'update : on retire puis on rajoute au besoin.

drop policy if exists "operation_writers_select" on public.operation_writers;
create policy "operation_writers_select"
  on public.operation_writers for select
  to authenticated
  using (public.can_access_operation(operation_id));

drop policy if exists "operation_writers_insert" on public.operation_writers;
create policy "operation_writers_insert"
  on public.operation_writers for insert
  to authenticated
  with check (
    public.is_active_agent()
    and (public.is_operation_lead(operation_id) or public.is_admin())
    and added_by = auth.uid()
    -- Le lead est déjà en accès complet par définition : inutile (et
    -- source de confusion) de l'ajouter aussi comme agent en écriture.
    and agent_id <> (
      select o.lead_id from public.operations o where o.id = operation_id
    )
    -- Un agent DOJ ne doit jamais obtenir l'accès, même par erreur
    -- d'ajout : verrou de défense en profondeur en plus du filtre côté
    -- interface (qui ne propose déjà que des agents non-DOJ).
    and not exists (
      select 1 from public.profiles p
      where p.id = agent_id and p.unite = 'DOJ'
    )
  );

drop policy if exists "operation_writers_delete" on public.operation_writers;
create policy "operation_writers_delete"
  on public.operation_writers for delete
  to authenticated
  using (public.is_operation_lead(operation_id) or public.is_admin());

-- ====================================================================
-- 5. RLS — tables de liaison
-- ====================================================================
-- Mêmes droits que la modification de l'opération elle-même : admin, lead
-- ou agent en écriture peuvent lier/délier un élément.

alter table public.operation_investigations enable row level security;
revoke all on public.operation_investigations from anon;
revoke all on public.operation_investigations from authenticated;
grant select, insert, delete on public.operation_investigations to authenticated;

drop policy if exists "operation_investigations_select" on public.operation_investigations;
create policy "operation_investigations_select"
  on public.operation_investigations for select
  to authenticated
  using (public.can_access_operation(operation_id));

drop policy if exists "operation_investigations_insert" on public.operation_investigations;
create policy "operation_investigations_insert"
  on public.operation_investigations for insert
  to authenticated
  with check (public.can_access_operation(operation_id));

drop policy if exists "operation_investigations_delete" on public.operation_investigations;
create policy "operation_investigations_delete"
  on public.operation_investigations for delete
  to authenticated
  using (public.can_access_operation(operation_id));

alter table public.operation_wanted_notices enable row level security;
revoke all on public.operation_wanted_notices from anon;
revoke all on public.operation_wanted_notices from authenticated;
grant select, insert, delete on public.operation_wanted_notices to authenticated;

drop policy if exists "operation_wanted_notices_select" on public.operation_wanted_notices;
create policy "operation_wanted_notices_select"
  on public.operation_wanted_notices for select
  to authenticated
  using (public.can_access_operation(operation_id));

drop policy if exists "operation_wanted_notices_insert" on public.operation_wanted_notices;
create policy "operation_wanted_notices_insert"
  on public.operation_wanted_notices for insert
  to authenticated
  with check (public.can_access_operation(operation_id));

drop policy if exists "operation_wanted_notices_delete" on public.operation_wanted_notices;
create policy "operation_wanted_notices_delete"
  on public.operation_wanted_notices for delete
  to authenticated
  using (public.can_access_operation(operation_id));

alter table public.operation_lab_markers enable row level security;
revoke all on public.operation_lab_markers from anon;
revoke all on public.operation_lab_markers from authenticated;
grant select, insert, delete on public.operation_lab_markers to authenticated;

drop policy if exists "operation_lab_markers_select" on public.operation_lab_markers;
create policy "operation_lab_markers_select"
  on public.operation_lab_markers for select
  to authenticated
  using (public.can_access_operation(operation_id));

drop policy if exists "operation_lab_markers_insert" on public.operation_lab_markers;
create policy "operation_lab_markers_insert"
  on public.operation_lab_markers for insert
  to authenticated
  with check (public.can_access_operation(operation_id));

drop policy if exists "operation_lab_markers_delete" on public.operation_lab_markers;
create policy "operation_lab_markers_delete"
  on public.operation_lab_markers for delete
  to authenticated
  using (public.can_access_operation(operation_id));

alter table public.operation_zones enable row level security;
revoke all on public.operation_zones from anon;
revoke all on public.operation_zones from authenticated;
grant select, insert, delete on public.operation_zones to authenticated;

drop policy if exists "operation_zones_select" on public.operation_zones;
create policy "operation_zones_select"
  on public.operation_zones for select
  to authenticated
  using (public.can_access_operation(operation_id));

drop policy if exists "operation_zones_insert" on public.operation_zones;
create policy "operation_zones_insert"
  on public.operation_zones for insert
  to authenticated
  with check (public.can_access_operation(operation_id));

drop policy if exists "operation_zones_delete" on public.operation_zones;
create policy "operation_zones_delete"
  on public.operation_zones for delete
  to authenticated
  using (public.can_access_operation(operation_id));

alter table public.operation_gangs enable row level security;
revoke all on public.operation_gangs from anon;
revoke all on public.operation_gangs from authenticated;
grant select, insert, delete on public.operation_gangs to authenticated;

drop policy if exists "operation_gangs_select" on public.operation_gangs;
create policy "operation_gangs_select"
  on public.operation_gangs for select
  to authenticated
  using (public.can_access_operation(operation_id));

drop policy if exists "operation_gangs_insert" on public.operation_gangs;
create policy "operation_gangs_insert"
  on public.operation_gangs for insert
  to authenticated
  with check (public.can_access_operation(operation_id));

drop policy if exists "operation_gangs_delete" on public.operation_gangs;
create policy "operation_gangs_delete"
  on public.operation_gangs for delete
  to authenticated
  using (public.can_access_operation(operation_id));
