-- Gang Task Force — audit pré-V1, point S10 : le code d'accès du casier
-- de preuves n'est plus lisible que par les unités en écriture sur les
-- enquêtes (ID / GTF / EM) et les admins.
-- À exécuter APRÈS investigations.sql, investigations_casier.sql et
-- permissions_unite.sql, et APRÈS le déploiement du code qui lit les
-- enquêtes colonne par colonne (commit « lot 3 »). IDEMPOTENT.
-- Dashboard Supabase → SQL Editor → New query.
--
-- Mécanisme : privilège de lecture par colonne. `authenticated` lit toutes
-- les colonnes SAUF casier_code_acces ; le code s'obtient uniquement par
-- la fonction get_casier_code(), qui vérifie l'unité de l'appelant.
-- L'écriture (création / modification) reste inchangée pour les unités
-- autorisées par la RLS.
--
-- ⚠ Toute NOUVELLE colonne ajoutée à investigations devra être ajoutée
-- au grant select ci-dessous, sinon elle sera illisible côté agents.

revoke select on public.investigations from authenticated;
grant select (
  id, titre, statut, suspects, preuves, description, agent_responsable,
  created_by, created_at, updated_at, deleted_at, casier_numero
) on public.investigations to authenticated;

create or replace function public.get_casier_code(target_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select i.casier_code_acces
  from public.investigations i
  where i.id = target_id
    and i.deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel();
$$;

revoke all on function public.get_casier_code(uuid) from public;
grant execute on function public.get_casier_code(uuid) to authenticated;
