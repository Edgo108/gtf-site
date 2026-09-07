-- Gang Task Force — le grade « Capitaine » obtient les mêmes droits que
-- le « Commandant » sur les notifications (annonces).
-- À exécuter APRÈS announcements.sql. Idempotent (create or replace).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Seule différence de permissions entre Capitaine et Commandant : la
-- création d'annonces (les policies update/delete d'annonces reposent sur
-- « créateur ou admin », pas sur le grade). On aligne donc la fonction.

create or replace function public.can_create_announcements()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and grade in ('Lieutenant', 'Capitaine', 'Commandant')
  );
$$;
