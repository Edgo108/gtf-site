-- Gang Task Force — audit pré-V1, lot 3 (points mineurs S8, S9, P7).
-- À exécuter APRÈS tous les autres fichiers supabase/*.sql, et APRÈS le
-- déploiement du code du lot 3 (le changement de mot de passe forcé passe
-- désormais par le serveur). IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.

-- ====================================================================
-- S8 — changement de mot de passe forcé
-- ====================================================================
-- Avant : un agent pouvait remettre lui-même `doit_changer_mdp` à false
-- via l'API, sans changer son mot de passe. Désormais seul le serveur
-- (service_role) le fait, en même temps que le changement de mot de passe
-- (lib/actions/auth.ts → completeForcedPasswordChange). Plus aucune
-- colonne de profiles n'est modifiable avec un jeton d'agent.

revoke update (doit_changer_mdp) on public.profiles from authenticated;
drop policy if exists "profiles_update_own" on public.profiles;

-- ====================================================================
-- S9 — insertion : seules les colonnes métier sont fournies par l'agent
-- ====================================================================
-- created_at / updated_at / deleted_at (et l'id) sont toujours posés par
-- la base : impossible de créer une fiche « antidatée » ou directement
-- en corbeille.

revoke insert on public.investigations from authenticated;
grant insert (
  titre, statut, suspects, preuves, description, agent_responsable,
  casier_numero, casier_code_acces, created_by
) on public.investigations to authenticated;

revoke insert on public.operations from authenticated;
grant insert (titre, description, statut, lead_id)
  on public.operations to authenticated;

-- ====================================================================
-- P7 — index sur les colonnes de liaison les plus filtrées
-- ====================================================================

create index if not exists gang_members_gang_id_idx on public.gang_members (gang_id);
create index if not exists investigation_history_investigation_id_idx on public.investigation_history (investigation_id);
create index if not exists zone_history_zone_id_idx on public.zone_history (zone_id);
create index if not exists lab_marker_history_marker_id_idx on public.lab_marker_history (marker_id);
create index if not exists lab_markers_organisation_id_idx on public.lab_markers (organisation_id);
create index if not exists lab_markers_investigation_id_idx on public.lab_markers (investigation_id);
create index if not exists sensitive_zones_gang_id_idx on public.sensitive_zones (gang_id);
create index if not exists wanted_notices_organisation_gang_id_idx on public.wanted_notices (organisation_gang_id);
create index if not exists announcement_reads_user_id_idx on public.announcement_reads (user_id);
create index if not exists agent_status_unite_id_idx on public.agent_status (unite_id);
-- Recherches inverses « dans quelles opérations est lié cet élément ? »
-- (le sens opération → éléments est déjà couvert par les contraintes
-- d'unicité (operation_id, …)).
create index if not exists operation_investigations_target_idx on public.operation_investigations (investigation_id);
create index if not exists operation_wanted_notices_target_idx on public.operation_wanted_notices (wanted_notice_id);
create index if not exists operation_lab_markers_target_idx on public.operation_lab_markers (lab_marker_id);
create index if not exists operation_zones_target_idx on public.operation_zones (zone_id);
create index if not exists operation_gangs_target_idx on public.operation_gangs (gang_id);
