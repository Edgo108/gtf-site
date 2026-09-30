-- Gang Task Force — correctif (audit pré-V1, point C1) : la suppression
-- définitive d'une organisation (gangs) ne doit plus supprimer en cascade
-- ses zones et ses labos sur la carte.
-- À exécuter APRÈS zones.sql et lab_markers.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Avant : `on delete cascade` → supprimer définitivement un gang effaçait
-- aussi toutes ses zones et tous ses labos, même actifs, sans corbeille.
-- Après : `on delete restrict` → la base refuse la suppression tant qu'il
-- reste des zones ou des labos rattachés (le serveur le vérifie aussi et
-- affiche un message clair). Membres (gang_members) et liens avec les
-- opérations restent supprimés avec le gang, comme avant.

alter table public.sensitive_zones
  drop constraint if exists sensitive_zones_gang_id_fkey;
alter table public.sensitive_zones
  add constraint sensitive_zones_gang_id_fkey
  foreign key (gang_id) references public.gangs (id) on delete restrict;

alter table public.lab_markers
  drop constraint if exists lab_markers_organisation_id_fkey;
alter table public.lab_markers
  add constraint lab_markers_organisation_id_fkey
  foreign key (organisation_id) references public.gangs (id) on delete restrict;
