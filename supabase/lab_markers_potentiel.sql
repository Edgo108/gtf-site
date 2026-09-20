-- Gang Task Force — statut « Potentiel » sur les marqueurs Laboratoire
-- À exécuter APRÈS lab_markers.sql. IDEMPOTENT (ré-exécutable sans
-- risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Ajoute un 3e statut "potentiel" (labo repéré mais pas encore
-- confirmé) : categorie devient nullable pour ce statut uniquement —
-- toujours obligatoire pour "actif"/"raided". Aucune ligne existante
-- n'est affectée (tous les marqueurs actuels ont déjà un statut et une
-- catégorie valides sous l'ancienne contrainte, donc conformes à la
-- nouvelle).

alter table public.lab_markers alter column categorie drop not null;

alter table public.lab_markers drop constraint if exists lab_markers_categorie_check;
alter table public.lab_markers
  add constraint lab_markers_categorie_check
  check (categorie is null or categorie in ('arme', 'cocaine', 'meth'));

alter table public.lab_markers drop constraint if exists lab_markers_statut_check;
alter table public.lab_markers
  add constraint lab_markers_statut_check
  check (statut in ('actif', 'raided', 'potentiel'));

alter table public.lab_markers
  drop constraint if exists lab_markers_categorie_required_unless_potentiel;
alter table public.lab_markers
  add constraint lab_markers_categorie_required_unless_potentiel
  check (statut = 'potentiel' or categorie is not null);
