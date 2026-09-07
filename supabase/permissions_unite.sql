-- Gang Task Force — 3e dimension de permissions : RÔLE / UNITÉ
-- À exécuter APRÈS tous les autres fichiers supabase/*.sql
-- (nécessite public.profiles, public.is_admin(), public.is_active_agent(),
--  et les tables investigations / wanted_notices / gangs / gang_members /
--  sensitive_zones / announcements + leurs policies).
--
-- Ce script est IDEMPOTENT : il peut être ré-exécuté sans risque
-- (drop policy/trigger if exists + create or replace partout,
--  add column if not exists).
--
-- Dashboard Supabase → SQL Editor → New query.

-- ====================================================================
-- 1. Colonne `unite` sur profiles
-- ====================================================================
-- 4 valeurs : ID (Unité d'enquête), GTF (Gang Task Force),
-- SASP (unité partenaire), DOJ (Department of Justice).
--
-- `not null default 'SASP'` : tous les comptes déjà créés (compte admin
-- inclus) reçoivent automatiquement 'SASP'. À charge pour l'admin de les
-- réattribuer ensuite depuis « Gestion des agents ».

alter table public.profiles
  add column if not exists unite text not null default 'SASP';

alter table public.profiles drop constraint if exists profiles_unite_check;
alter table public.profiles
  add constraint profiles_unite_check
  check (unite in ('ID', 'GTF', 'SASP', 'DOJ'));

-- Filet de sécurité si la colonne existait déjà sans valeur (ré-exécution).
update public.profiles set unite = 'SASP' where unite is null;

-- L'agent connecté peut écrire la colonne `unite` (et uniquement elle,
-- côté autres profils — voir le trigger plus bas). Les lignes réellement
-- modifiables sont filtrées par la policy profiles_update_unite.
grant update (unite) on public.profiles to authenticated;

-- ====================================================================
-- 2. Qui peut modifier le rôle/unité d'un compte
-- ====================================================================
-- L'admin (déjà gestionnaire de comptes) OU un agent dont le grade est
-- Commandant / Capitaine / Lieutenant. Lit uniquement la ligne "profiles"
-- de l'appelant (autorisée par profiles_select_own) : aucune élévation.

create or replace function public.can_manage_unite()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or grade in ('Commandant', 'Capitaine', 'Lieutenant')
      )
  );
$$;

grant execute on function public.can_manage_unite() to authenticated;

-- Policy UPDATE additionnelle : un habilité peut viser n'importe quelle
-- ligne de profiles. profiles_update_own (id = auth.uid()) reste en place ;
-- PostgreSQL applique un OU entre policies permissives.
drop policy if exists "profiles_update_unite" on public.profiles;
create policy "profiles_update_unite"
  on public.profiles for update
  to authenticated
  using (public.can_manage_unite())
  with check (public.can_manage_unite());

-- Le grant de colonnes (doit_changer_mdp + unite) est une union : sans
-- garde-fou, un habilité pourrait aussi toucher doit_changer_mdp sur un
-- autre compte. Ce trigger limite strictement la modification d'un AUTRE
-- profil à la seule colonne `unite`. Il ne gêne pas l'admin applicatif
-- (clé service_role → auth.uid() vaut NULL → la condition est ignorée).
create or replace function public.enforce_profile_cross_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null and new.id <> auth.uid() then
    if not public.can_manage_unite() then
      raise exception 'Non autorisé à modifier ce profil.';
    end if;
    if new.pseudo is distinct from old.pseudo
       or new.role is distinct from old.role
       or new.statut is distinct from old.statut
       or new.grade is distinct from old.grade
       or new.doit_changer_mdp is distinct from old.doit_changer_mdp
       or new.created_at is distinct from old.created_at then
      raise exception
        'Seule l''unité peut être modifiée sur un autre compte.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_enforce_cross_update on public.profiles;
create trigger trg_profiles_enforce_cross_update
before update on public.profiles
for each row execute function public.enforce_profile_cross_update();

-- ====================================================================
-- 3. Matrice de permissions par unité (helpers RLS)
-- ====================================================================
-- Lecture : toujours autorisée pour un agent actif (aucune policy SELECT
-- n'est modifiée). Écriture : selon la matrice ci-dessous.
--
--  Unité | Enquêtes | Mandats | Gangs | Carte | Notifications
--  ------|----------|---------|-------|-------|-------------
--  ID    |   R/W    |   R/W   |  R/W  |  R/W  |    R/W
--  GTF   |   R/W    |   R/W   |  R/W  |  R/W  |    R/W
--  SASP  |    R     |    R    |   R   |   R   |     R
--  DOJ   |    R     |   R/W   |   R   |   R   |     R
--
-- Le compte admin garde tous ses droits quelle que soit son unité :
-- chaque helper renvoie true si public.is_admin().

create or replace function public.mon_unite()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select unite from public.profiles where id = auth.uid();
$$;

grant execute on function public.mon_unite() to authenticated;

-- Écriture "opérationnelle" : enquêtes, gangs, gang_members, zones, annonces.
create or replace function public.unite_peut_ecrire_operationnel()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_admin() or public.mon_unite() in ('ID', 'GTF');
$$;

-- Écriture "mandats" : ID, GTF + DOJ.
create or replace function public.unite_peut_ecrire_mandats()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_admin() or public.mon_unite() in ('ID', 'GTF', 'DOJ');
$$;

grant execute on function public.unite_peut_ecrire_operationnel() to authenticated;
grant execute on function public.unite_peut_ecrire_mandats() to authenticated;

-- ====================================================================
-- 4. Application de la matrice aux policies d'écriture
-- ====================================================================
-- Les conditions déjà en place sont conservées TELLES QUELLES et la
-- condition d'unité s'y AJOUTE (AND). Ex. pour les enquêtes : le créateur
-- reste le seul (avec l'admin) à pouvoir supprimer — et en plus il faut
-- désormais une unité habilitée à écrire.

-- --- investigations --------------------------------------------------
drop policy if exists "investigations_insert" on public.investigations;
create policy "investigations_insert"
  on public.investigations for insert
  to authenticated
  with check (
    public.is_active_agent()
    and created_by = auth.uid()
    and public.unite_peut_ecrire_operationnel()
  );

drop policy if exists "investigations_update" on public.investigations;
create policy "investigations_update"
  on public.investigations for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  )
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

-- --- wanted_notices -------------------------------------------------
drop policy if exists "wanted_notices_insert" on public.wanted_notices;
create policy "wanted_notices_insert"
  on public.wanted_notices for insert
  to authenticated
  with check (
    public.is_active_agent()
    and created_by = auth.uid()
    and public.unite_peut_ecrire_mandats()
  );

drop policy if exists "wanted_notices_update" on public.wanted_notices;
create policy "wanted_notices_update"
  on public.wanted_notices for update
  to authenticated
  using (
    public.is_active_agent()
    and public.unite_peut_ecrire_mandats()
  )
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_mandats()
  );

drop policy if exists "wanted_notices_delete" on public.wanted_notices;
create policy "wanted_notices_delete"
  on public.wanted_notices for delete
  to authenticated
  using (
    public.is_active_agent()
    and public.unite_peut_ecrire_mandats()
  );

-- --- gangs ---------------------------------------------------------
drop policy if exists "gangs_insert" on public.gangs;
create policy "gangs_insert"
  on public.gangs for insert
  to authenticated
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

drop policy if exists "gangs_update" on public.gangs;
create policy "gangs_update"
  on public.gangs for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  )
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

-- --- gang_members ------------------------------------------------
drop policy if exists "gang_members_insert" on public.gang_members;
create policy "gang_members_insert"
  on public.gang_members for insert
  to authenticated
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

drop policy if exists "gang_members_update" on public.gang_members;
create policy "gang_members_update"
  on public.gang_members for update
  to authenticated
  using (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  )
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

drop policy if exists "gang_members_delete" on public.gang_members;
create policy "gang_members_delete"
  on public.gang_members for delete
  to authenticated
  using (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

-- --- sensitive_zones -------------------------------------------
drop policy if exists "sensitive_zones_insert" on public.sensitive_zones;
create policy "sensitive_zones_insert"
  on public.sensitive_zones for insert
  to authenticated
  with check (
    public.is_active_agent()
    and created_by = auth.uid()
    and public.unite_peut_ecrire_operationnel()
  );

-- Conserve la garde anti-conflit (zone_locks) ET ajoute l'unité.
drop policy if exists "sensitive_zones_update" on public.sensitive_zones;
create policy "sensitive_zones_update"
  on public.sensitive_zones for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
    and not exists (
      select 1 from public.zone_locks
      where zone_locks.zone_id = sensitive_zones.id
        and zone_locks.locked_by <> auth.uid()
        and zone_locks.locked_at > now() - interval '3 minutes'
    )
  )
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

-- --- announcements --------------------------------------------
-- Conserve la garde de grade (public.can_create_announcements) ET ajoute
-- l'unité.
drop policy if exists "announcements_insert" on public.announcements;
create policy "announcements_insert"
  on public.announcements for insert
  to authenticated
  with check (
    public.is_active_agent()
    and public.can_create_announcements()
    and created_by = auth.uid()
    and public.unite_peut_ecrire_operationnel()
  );

drop policy if exists "announcements_update" on public.announcements;
create policy "announcements_update"
  on public.announcements for update
  to authenticated
  using (
    public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
    and public.unite_peut_ecrire_operationnel()
  )
  with check (
    public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
    and public.unite_peut_ecrire_operationnel()
  );

drop policy if exists "announcements_delete" on public.announcements;
create policy "announcements_delete"
  on public.announcements for delete
  to authenticated
  using (
    public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
    and public.unite_peut_ecrire_operationnel()
  );
