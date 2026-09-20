-- Gang Task Force — organisation détectée sur un mandat de recherche
-- À exécuter APRÈS wanted_notices.sql et gangs.sql. IDEMPOTENT
-- (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Stocke la correspondance exacte trouvée entre wanted_notices.nom_suspect
-- et un membre de gang_members, pour affichage sur la fiche du mandat.
-- Calculée côté serveur (Server Action, app/(app)/mandats/actions.ts) à
-- la création du mandat et à chaque modification du nom du suspect —
-- ne se met PAS à jour toute seule si gang_members change indépendamment.

alter table public.wanted_notices
  add column if not exists organisation_gang_id uuid
    references public.gangs (id) on delete set null;

-- Écrite comme les autres champs du mandat (grant insert déjà table-wide,
-- pas de restriction par colonne à ajouter côté insert).
grant update (organisation_gang_id) on public.wanted_notices to authenticated;
