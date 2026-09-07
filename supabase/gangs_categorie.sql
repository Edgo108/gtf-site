-- Gang Task Force — catégorisation des fiches « B.D.D » (table public.gangs)
-- À exécuter APRÈS gangs.sql. IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- N'ajoute qu'une étiquette de catégorie ; aucun autre champ ne change.
-- Le nom technique de la table (`gangs`) et de ses colonnes reste inchangé,
-- seul le libellé affiché dans l'interface devient « B.D.D ».

-- 3 valeurs : Gang, MC (Motorcycle Club), Orga (Organisation).
-- `not null default 'Gang'` : toutes les fiches déjà créées reçoivent
-- automatiquement 'Gang' (seule catégorie qui existait jusqu'ici).
alter table public.gangs
  add column if not exists categorie text not null default 'Gang';

alter table public.gangs drop constraint if exists gangs_categorie_check;
alter table public.gangs
  add constraint gangs_categorie_check
  check (categorie in ('Gang', 'MC', 'Orga'));

-- Filet de sécurité si la colonne existait déjà sans valeur (ré-exécution).
update public.gangs set categorie = 'Gang' where categorie is null;

-- La catégorie s'écrit comme les autres champs de la fiche (agent actif,
-- filtré ensuite par la policy gangs_update + la matrice d'unité).
grant update (categorie) on public.gangs to authenticated;
