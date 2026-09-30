-- Gang Task Force — protection anti-suppression du compte « Edgo »
-- À exécuter APRÈS schema.sql. IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Protection codée en dur pour CE SEUL compte (identifiant de connexion
-- edgo@gtf.local), repéré par son id plutôt que par son pseudo : le
-- pseudo reste modifiable, l'id jamais. Seule la SUPPRESSION est bloquée ;
-- toutes les autres modifications du compte restent possibles.
--
-- Le trigger s'applique à tout le monde, service_role compris. La
-- suppression d'un compte passe par auth.admin.deleteUser(), qui supprime
-- la ligne auth.users puis, en cascade, la ligne profiles : l'exception
-- levée ici annule toute l'opération, le compte d'authentification
-- compris.

create or replace function public.protect_edgo_account()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.id = '171b373d-5cdf-4485-a65b-ccb7e31ba82c' then
    raise exception 'Le compte Edgo est protégé : sa suppression est impossible.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_edgo_account on public.profiles;
create trigger trg_protect_edgo_account
before delete on public.profiles
for each row execute function public.protect_edgo_account();
