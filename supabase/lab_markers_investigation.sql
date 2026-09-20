-- Gang Task Force — lien optionnel labo ↔ enquête
-- À exécuter APRÈS lab_markers.sql et investigations.sql. IDEMPOTENT
-- (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Un labo peut être lié à UNE SEULE enquête à la fois (colonne simple,
-- pas de table de liaison). on delete set null : la suppression
-- définitive d'une enquête ne supprime pas le labo, elle retire juste
-- le lien.

alter table public.lab_markers
  add column if not exists investigation_id uuid
    references public.investigations (id) on delete set null;

grant update (investigation_id) on public.lab_markers to authenticated;
