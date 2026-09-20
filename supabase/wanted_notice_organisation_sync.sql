-- Gang Task Force — synchronisation B.D.D. → mandats (organisation)
-- À exécuter APRÈS wanted_notice_organisation.sql et gangs.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Le sens "mandat → B.D.D." (recalcul à la création/modification d'un
-- mandat) est géré côté application, dans
-- app/(app)/mandats/actions.ts (resolveOrganisationGangId). Ce fichier
-- ajoute le sens inverse "B.D.D. → mandat" via des triggers, pour que
-- wanted_notices.organisation_gang_id se remette à jour tout seul quand
-- gang_members change — y compris via un canal autre que
-- l'application (SQL direct, script, etc.), puisque c'est un trigger
-- de base de données et non une Server Action.

-- --- Normalisation du nom -------------------------------------------------
-- Mêmes règles que lib/investigations/suspects.ts côté app : casse,
-- accents et espaces superflus ignorés, mais pas de correspondance
-- floue/partielle. `unaccent` remplace le .normalize("NFD") + retrait
-- des diacritiques fait côté JS.

create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_name(value text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select regexp_replace(
    trim(lower(extensions.unaccent(coalesce(value, '')))),
    '\s+', ' ', 'g'
  );
$$;

revoke all on function public.normalize_name(text) from public;

-- --- Recalcul d'un nom donné ----------------------------------------------
-- Reprend la même règle que resolveOrganisationGangId côté app :
-- correspondance exacte, organisation non archivée (gangs.deleted_at is
-- null). En cas d'homonymes dans des organisations différentes, le
-- membre le plus ancien (created_at) l'emporte — cas limite non
-- spécifié, mais départage identique des deux côtés (voir le commentaire
-- sur resolveOrganisationGangId).
-- security definer : la mise à jour de wanted_notices doit réussir même
-- si elle est déclenchée par un agent qui n'a par ailleurs pas modifié
-- ce mandat lui-même (le trigger part de gang_members, pas d'une Server
-- Action sur wanted_notices).
create or replace function public.recompute_wanted_notice_organisation(
  target_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_gang_id uuid;
begin
  if target_name is null or target_name = '' then
    return;
  end if;

  select gm.gang_id into matched_gang_id
  from public.gang_members gm
  join public.gangs g on g.id = gm.gang_id and g.deleted_at is null
  where public.normalize_name(gm.nom) = target_name
  order by gm.created_at asc
  limit 1;

  update public.wanted_notices wn
  set organisation_gang_id = matched_gang_id
  where public.normalize_name(wn.nom_suspect) = target_name
    and wn.organisation_gang_id is distinct from matched_gang_id;
end;
$$;

revoke all on function public.recompute_wanted_notice_organisation(text) from public;

-- --- Trigger gang_members --------------------------------------------------
-- Création, renommage, changement d'organisation ou suppression d'un
-- membre : recalcule les mandats liés au nouveau nom, et à l'ancien nom
-- si celui-ci a changé (il peut encore correspondre à un autre membre,
-- ou ne plus correspondre à personne).

create or replace function public.trg_sync_wanted_notice_organisation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_wanted_notice_organisation(
      public.normalize_name(old.nom)
    );
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (old.nom is distinct from new.nom
          or old.gang_id is distinct from new.gang_id) then
    perform public.recompute_wanted_notice_organisation(
      public.normalize_name(old.nom)
    );
  end if;

  perform public.recompute_wanted_notice_organisation(
    public.normalize_name(new.nom)
  );
  return new;
end;
$$;

drop trigger if exists trg_gang_members_sync_organisation on public.gang_members;
create trigger trg_gang_members_sync_organisation
after insert or update of nom, gang_id or delete on public.gang_members
for each row execute function public.trg_sync_wanted_notice_organisation();

-- --- Trigger gangs (archivage / restauration) ------------------------------
-- Sans ce trigger, un mandat resterait affiché avec une organisation
-- archivée (corbeille), ou resterait à "Aucune organisation identifiée"
-- après restauration, tant que gang_members ou le mandat lui-même n'est
-- pas retouché.

create or replace function public.trg_sync_wanted_notice_organisation_on_gang()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_name text;
begin
  if old.deleted_at is distinct from new.deleted_at then
    for member_name in
      select distinct public.normalize_name(nom)
      from public.gang_members
      where gang_id = new.id
    loop
      perform public.recompute_wanted_notice_organisation(member_name);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gangs_sync_organisation on public.gangs;
create trigger trg_gangs_sync_organisation
after update of deleted_at on public.gangs
for each row execute function public.trg_sync_wanted_notice_organisation_on_gang();

-- --- Rattrapage ponctuel ----------------------------------------------------
-- Applique la règle à tous les mandats existants dès l'exécution de
-- cette migration (idempotent : sans effet si déjà à jour).

do $$
declare
  suspect_name text;
begin
  for suspect_name in
    select distinct public.normalize_name(nom_suspect)
    from public.wanted_notices
  loop
    perform public.recompute_wanted_notice_organisation(suspect_name);
  end loop;
end;
$$;
