-- Gang Task Force — nouvelle unité « EM » (État-Major).
-- À exécuter APRÈS permissions_unite.sql. Idempotent.
-- Dashboard Supabase → SQL Editor → New query.
--
-- L'État-Major est en lecture + écriture absolument partout (mêmes droits
-- qu'ID / GTF sur l'opérationnel, et que DOJ sur les mandats). Le compte
-- admin garde par ailleurs ses super-droits indépendamment de l'unité.

-- 1. Autoriser la valeur 'EM' sur profiles.unite
alter table public.profiles drop constraint if exists profiles_unite_check;
alter table public.profiles
  add constraint profiles_unite_check
  check (unite in ('ID', 'GTF', 'SASP', 'DOJ', 'EM'));

-- 2. Ajouter 'EM' aux helpers d'écriture de la matrice
create or replace function public.unite_peut_ecrire_operationnel()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_admin() or public.mon_unite() in ('ID', 'GTF', 'EM');
$$;

create or replace function public.unite_peut_ecrire_mandats()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_admin() or public.mon_unite() in ('ID', 'GTF', 'DOJ', 'EM');
$$;
