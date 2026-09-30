-- Gang Task Force — point Q6 : corbeille pour les mandats, les opérations,
-- les annonces et les patch notes (jusqu'ici supprimés définitivement).
-- À exécuter APRÈS wanted_notices.sql, announcements.sql, patch_notes.sql,
-- operations.sql, permissions_unite.sql et capitaine_annonces.sql, et
-- APRÈS le déploiement du code correspondant. IDEMPOTENT.
-- Dashboard Supabase → SQL Editor → New query.
--
-- Même modèle que les enquêtes / la B.D.D. / la carte / les archives :
--   - `deleted_at` renseigné = fiche dans la corbeille, invisible pour les
--     agents (policies SELECT/UPDATE filtrées) ;
--   - plus AUCUNE suppression directe avec un jeton d'agent : la mise à la
--     corbeille, la restauration et la suppression définitive passent par
--     le serveur (service_role) après vérification des droits ;
--   - restauration / suppression définitive : admin uniquement.

alter table public.wanted_notices add column if not exists deleted_at timestamptz;
alter table public.operations add column if not exists deleted_at timestamptz;
alter table public.announcements add column if not exists deleted_at timestamptz;
alter table public.patch_notes add column if not exists deleted_at timestamptz;

-- ====================================================================
-- Mandats
-- ====================================================================

revoke delete on public.wanted_notices from authenticated;
drop policy if exists "wanted_notices_delete" on public.wanted_notices;

drop policy if exists "wanted_notices_select" on public.wanted_notices;
create policy "wanted_notices_select"
  on public.wanted_notices for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

drop policy if exists "wanted_notices_update" on public.wanted_notices;
create policy "wanted_notices_update"
  on public.wanted_notices for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_ecrire_mandats()
  )
  with check (
    public.is_active_agent()
    and public.unite_peut_ecrire_mandats()
  );

-- ====================================================================
-- Opérations (droits d'accès inchangés : admin / lead / agent en écriture)
-- ====================================================================

revoke delete on public.operations from authenticated;
drop policy if exists "operations_delete" on public.operations;

drop policy if exists "operations_select" on public.operations;
create policy "operations_select"
  on public.operations for select
  to authenticated
  using (deleted_at is null and public.can_access_operation(id));

drop policy if exists "operations_update" on public.operations;
create policy "operations_update"
  on public.operations for update
  to authenticated
  using (deleted_at is null and public.can_access_operation(id))
  with check (public.can_access_operation(id));

-- ====================================================================
-- Annonces
-- ====================================================================

revoke delete on public.announcements from authenticated;
drop policy if exists "announcements_delete" on public.announcements;

drop policy if exists "announcements_select" on public.announcements;
create policy "announcements_select"
  on public.announcements for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

drop policy if exists "announcements_update" on public.announcements;
create policy "announcements_update"
  on public.announcements for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
    and public.unite_peut_ecrire_operationnel()
  )
  with check (
    public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
    and public.unite_peut_ecrire_operationnel()
  );

-- ====================================================================
-- Patch notes (écriture admin seule, inchangée)
-- ====================================================================

revoke delete on public.patch_notes from authenticated;
drop policy if exists "patch_notes_delete" on public.patch_notes;

drop policy if exists "patch_notes_select" on public.patch_notes;
create policy "patch_notes_select"
  on public.patch_notes for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

drop policy if exists "patch_notes_update" on public.patch_notes;
create policy "patch_notes_update"
  on public.patch_notes for update
  to authenticated
  using (deleted_at is null and public.is_admin())
  with check (public.is_admin());
