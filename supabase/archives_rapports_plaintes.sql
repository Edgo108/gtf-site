-- Gang Task Force — Archives : Rapports + Plaintes
-- À exécuter APRÈS schema.sql et investigations.sql (réutilise
-- public.is_active_agent(), public.is_admin(), public.set_updated_at()).
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Permissions (volontairement hors matrice par unité) :
--   - tout agent actif (non suspendu) : lecture, création, modification ;
--   - corbeille (deleted_at) : créateur ou admin, via le serveur
--     (clé service_role) après vérification applicative ;
--   - restauration / suppression définitive : admin seul, via le serveur.
-- Aucun grant DELETE ni sur deleted_at pour authenticated.

-- ====================================================================
-- 1. Séquences dédiées (numérotation continue, jamais réinitialisée)
-- ====================================================================

create sequence if not exists public.rapports_numero_seq start with 1 increment by 1;
create sequence if not exists public.plaintes_numero_seq start with 1 increment by 1;

-- ====================================================================
-- 2. Tables
-- ====================================================================

create table if not exists public.rapports (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique default nextval('public.rapports_numero_seq'),
  date_redaction timestamptz not null default now(),
  date_intervention timestamptz,
  agent_redacteur_id uuid not null references public.profiles (id) on delete restrict,
  -- Tableau d'ids de profiles (pas de FK possible sur un tableau : la
  -- validation est faite côté serveur à l'enregistrement).
  agents_lies uuid[] not null default '{}',
  nom_suspect text not null default '',
  date_lecture_miranda timestamptz,
  faits_reproches text not null default '',
  descriptif_situation text not null default '',
  signature_agent_redacteur text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter sequence public.rapports_numero_seq owned by public.rapports.numero;

drop trigger if exists trg_rapports_updated_at on public.rapports;
create trigger trg_rapports_updated_at
before update on public.rapports
for each row execute function public.set_updated_at();

create table if not exists public.plaintes (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique default nextval('public.plaintes_numero_seq'),
  date_redaction timestamptz not null default now(),
  date_faits timestamptz,
  nom_victime text not null default '',
  agent_redacteur_id uuid not null references public.profiles (id) on delete restrict,
  descriptif_plainte text not null default '',
  signature_victime text,
  signature_agent_assermente text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter sequence public.plaintes_numero_seq owned by public.plaintes.numero;

drop trigger if exists trg_plaintes_updated_at on public.plaintes;
create trigger trg_plaintes_updated_at
before update on public.plaintes
for each row execute function public.set_updated_at();

-- ====================================================================
-- 3. RLS — rapports
-- ====================================================================

alter table public.rapports enable row level security;

revoke all on public.rapports from anon;
revoke all on public.rapports from authenticated;

grant select on public.rapports to authenticated;
-- Insert par colonne : `numero` reste toujours celui de la séquence,
-- `deleted_at` / horodatages techniques ne sont pas forgeables.
grant insert (
  date_redaction, date_intervention, agent_redacteur_id, agents_lies,
  nom_suspect, date_lecture_miranda, faits_reproches, descriptif_situation,
  signature_agent_redacteur, created_by
) on public.rapports to authenticated;
grant update (
  date_redaction, date_intervention, agent_redacteur_id, agents_lies,
  nom_suspect, date_lecture_miranda, faits_reproches, descriptif_situation,
  signature_agent_redacteur
) on public.rapports to authenticated;
-- nextval() par le default de `numero` exige USAGE sur la séquence.
grant usage on sequence public.rapports_numero_seq to authenticated;

drop policy if exists "rapports_select" on public.rapports;
create policy "rapports_select"
  on public.rapports for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

drop policy if exists "rapports_insert" on public.rapports;
create policy "rapports_insert"
  on public.rapports for insert
  to authenticated
  with check (public.is_active_agent() and created_by = auth.uid());

drop policy if exists "rapports_update" on public.rapports;
create policy "rapports_update"
  on public.rapports for update
  to authenticated
  using (deleted_at is null and public.is_active_agent())
  with check (public.is_active_agent());

-- ====================================================================
-- 4. RLS — plaintes
-- ====================================================================

alter table public.plaintes enable row level security;

revoke all on public.plaintes from anon;
revoke all on public.plaintes from authenticated;

grant select on public.plaintes to authenticated;
grant insert (
  date_redaction, date_faits, nom_victime, agent_redacteur_id,
  descriptif_plainte, signature_victime, signature_agent_assermente,
  created_by
) on public.plaintes to authenticated;
grant update (
  date_redaction, date_faits, nom_victime, agent_redacteur_id,
  descriptif_plainte, signature_victime, signature_agent_assermente
) on public.plaintes to authenticated;
grant usage on sequence public.plaintes_numero_seq to authenticated;

drop policy if exists "plaintes_select" on public.plaintes;
create policy "plaintes_select"
  on public.plaintes for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

drop policy if exists "plaintes_insert" on public.plaintes;
create policy "plaintes_insert"
  on public.plaintes for insert
  to authenticated
  with check (public.is_active_agent() and created_by = auth.uid());

drop policy if exists "plaintes_update" on public.plaintes;
create policy "plaintes_update"
  on public.plaintes for update
  to authenticated
  using (deleted_at is null and public.is_active_agent())
  with check (public.is_active_agent());
