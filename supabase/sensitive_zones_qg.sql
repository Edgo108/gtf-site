-- Gang Task Force — renommage du type de zone « Influence » → « QG »
-- À exécuter APRÈS zones.sql. IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Changement de la valeur technique stockée (pas qu'un renommage
-- d'affichage) : sensitive_zones.type_zone passe de "influence" à "qg".
-- Style visuel inchangé (bordure en pointillés) — seul le nom change,
-- géré côté app dans components/zones/InteractiveMap.tsx et consorts.

-- La contrainte doit être élargie AVANT la mise à jour des lignes,
-- sinon l'UPDATE vers 'qg' est rejeté par l'ancienne contrainte
-- ('vente', 'influence' uniquement).
alter table public.sensitive_zones
  drop constraint if exists sensitive_zones_type_zone_check;
alter table public.sensitive_zones
  add constraint sensitive_zones_type_zone_check
  check (type_zone in ('vente', 'influence', 'qg'));

update public.sensitive_zones
  set type_zone = 'qg'
  where type_zone = 'influence';

-- Resserre la contrainte définitive une fois la migration des lignes
-- faite : "influence" n'est plus une valeur valide.
alter table public.sensitive_zones
  drop constraint if exists sensitive_zones_type_zone_check;
alter table public.sensitive_zones
  add constraint sensitive_zones_type_zone_check
  check (type_zone in ('vente', 'qg'));
