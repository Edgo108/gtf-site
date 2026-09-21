-- Gang Task Force — CORRECTIF DE SÉCURITÉ : plus d'auto-promotion d'unité
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query.
-- IDEMPOTENT (ré-exécutable sans risque). Indépendant de l'ordre des autres
-- fichiers, mais à lancer APRÈS permissions_unite.sql s'il n'a pas encore
-- été exécuté (sinon les objets ci-dessous n'existent simplement pas).
--
-- PROBLÈME CORRIGÉ
-- permissions_unite.sql accordait `update (unite)` à tout compte connecté.
-- Combiné à la policy profiles_update_own (id = auth.uid()), n'importe quel
-- agent pouvait, depuis son navigateur (clé publique + son propre jeton),
-- s'écrire `unite = 'EM'` sur SA PROPRE ligne. Le trigger de protection ne
-- couvrait que les lignes des AUTRES comptes. La matrice ID/GTF/SASP/DOJ/EM
-- pouvait donc être contournée par un simple appel API.
--
-- CORRECTION
-- Le changement d'unité passe UNIQUEMENT par le serveur (Server Action
-- updateAgentUnite → clé service_role, après vérification admin /
-- Commandant / Capitaine / Lieutenant). La base n'a donc plus aucune raison
-- de l'autoriser à un compte connecté :
--   1. on retire le privilège de colonne `update (unite)` ;
--   2. on supprime la policy profiles_update_unite (qui permettait à un
--      grade habilité de viser d'autres lignes en direct) ;
--   3. on verrouille en plus par trigger (ceinture + bretelles) : un appel
--      avec un jeton utilisateur ne peut modifier QUE `doit_changer_mdp`
--      sur sa propre ligne — aucune autre colonne, même si un grant est
--      ajouté par erreur plus tard. La clé service_role (auth.uid() NULL)
--      n'est pas concernée.

-- 1. Plus de droit d'écriture direct sur `unite`
revoke update (unite) on public.profiles from authenticated;

-- 2. Plus de policy d'écriture sur les lignes des autres comptes
drop policy if exists "profiles_update_unite" on public.profiles;

-- 3. Trigger de verrouillage
create or replace function public.enforce_profile_cross_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- auth.uid() est NULL pour la clé service_role (Server Actions
  -- d'administration) : ces appels-là restent libres.
  if auth.uid() is not null then
    if new.id is distinct from old.id
       or new.pseudo is distinct from old.pseudo
       or new.role is distinct from old.role
       or new.statut is distinct from old.statut
       or new.grade is distinct from old.grade
       or new.unite is distinct from old.unite
       or new.created_at is distinct from old.created_at then
      raise exception
        'Modification interdite : seul le serveur peut changer ce champ.';
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
-- VÉRIFICATION (à lancer après, facultatif) — doit renvoyer :
--   * 1re requête : aucune ligne avec column_name = 'unite'
--   * 2e requête  : aucune ligne
-- ====================================================================
-- select grantee, column_name, privilege_type
-- from information_schema.column_privileges
-- where table_schema = 'public' and table_name = 'profiles'
--   and grantee = 'authenticated' and privilege_type = 'UPDATE';
--
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'profiles';
--   -- attendu : profiles_select_own (SELECT) et profiles_update_own (UPDATE)
