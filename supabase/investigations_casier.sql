-- Gang Task Force — casier de preuves physique lié à une enquête
-- À exécuter APRÈS investigations.sql. IDEMPOTENT (ré-exécutable sans
-- risque). Dashboard Supabase → SQL Editor → New query.
--
-- 2 champs texte libres, optionnels : référence un casier de preuves du
-- serveur RP (numéro + code d'accès). Aucune contrainte de format.

alter table public.investigations
  add column if not exists casier_numero text,
  add column if not exists casier_code_acces text;

-- Écrits comme les autres champs du formulaire enquête (le grant insert
-- est déjà table-wide, seul l'update est restreint par colonne).
grant update (casier_numero, casier_code_acces)
  on public.investigations to authenticated;
