-- Gang Task Force — « Mode test » des Rapports et Plaintes
-- (entraînement des nouveaux agents, sans polluer les vraies archives)
-- À exécuter APRÈS archives_rapports_plaintes.sql et attachments.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Règles appliquées ici, en base :
--   - un document est soit officiel (`numero`, séquence officielle), soit
--     un test (`numero_test`, séquence de test dédiée), jamais les deux ni
--     aucun des deux ;
--   - le numéro est attribué par un trigger à l'insertion : un test ne
--     consomme JAMAIS la séquence officielle (plus de valeur par défaut
--     sur `numero`, qui était évaluée avant tout trigger) ;
--   - `est_test` et les numéros sont figés après la création (trigger,
--     service_role compris) : pas de conversion test ⇄ officiel ;
--   - un test ne passe jamais par la corbeille : suppression définitive
--     directe, par son créateur ou un admin (policy DELETE) ;
--   - un test n'a pas de pièces jointes (table + bucket refusent).

-- ====================================================================
-- 1. Colonnes, séquences, contraintes
-- ====================================================================

alter table public.rapports add column if not exists est_test boolean not null default false;
alter table public.rapports add column if not exists numero_test bigint;
alter table public.plaintes add column if not exists est_test boolean not null default false;
alter table public.plaintes add column if not exists numero_test bigint;

alter table public.rapports alter column numero drop default;
alter table public.rapports alter column numero drop not null;
alter table public.plaintes alter column numero drop default;
alter table public.plaintes alter column numero drop not null;

create sequence if not exists public.rapports_test_numero_seq start with 1 increment by 1;
create sequence if not exists public.plaintes_test_numero_seq start with 1 increment by 1;
alter sequence public.rapports_test_numero_seq owned by public.rapports.numero_test;
alter sequence public.plaintes_test_numero_seq owned by public.plaintes.numero_test;

create unique index if not exists rapports_numero_test_key on public.rapports (numero_test);
create unique index if not exists plaintes_numero_test_key on public.plaintes (numero_test);

alter table public.rapports drop constraint if exists rapports_numero_ou_test;
alter table public.rapports add constraint rapports_numero_ou_test check (
  (est_test and numero is null and numero_test is not null)
  or (not est_test and numero is not null and numero_test is null)
);
alter table public.plaintes drop constraint if exists plaintes_numero_ou_test;
alter table public.plaintes add constraint plaintes_numero_ou_test check (
  (est_test and numero is null and numero_test is not null)
  or (not est_test and numero is not null and numero_test is null)
);

-- Pas de corbeille pour un test.
alter table public.rapports drop constraint if exists rapports_test_sans_corbeille;
alter table public.rapports add constraint rapports_test_sans_corbeille
  check (not est_test or deleted_at is null);
alter table public.plaintes drop constraint if exists plaintes_test_sans_corbeille;
alter table public.plaintes add constraint plaintes_test_sans_corbeille
  check (not est_test or deleted_at is null);

-- ====================================================================
-- 2. Numérotation à l'insertion
-- ====================================================================
-- tg_argv[0] = séquence officielle, tg_argv[1] = séquence de test.
-- SECURITY DEFINER : l'agent n'a pas besoin de droits sur les séquences,
-- et aucun numéro fourni par le client n'est conservé.

create or replace function public.archives_assign_numero()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.est_test then
    new.numero := null;
    new.numero_test := nextval(tg_argv[1]::regclass);
  else
    new.numero := nextval(tg_argv[0]::regclass);
    new.numero_test := null;
  end if;
  return new;
end;
$$;

revoke all on function public.archives_assign_numero() from public, anon, authenticated;

drop trigger if exists trg_rapports_assign_numero on public.rapports;
create trigger trg_rapports_assign_numero
before insert on public.rapports
for each row execute function public.archives_assign_numero(
  'public.rapports_numero_seq', 'public.rapports_test_numero_seq'
);

drop trigger if exists trg_plaintes_assign_numero on public.plaintes;
create trigger trg_plaintes_assign_numero
before insert on public.plaintes
for each row execute function public.archives_assign_numero(
  'public.plaintes_numero_seq', 'public.plaintes_test_numero_seq'
);

-- ====================================================================
-- 3. Statut test et numéros figés après la création
-- ====================================================================

create or replace function public.archives_lock_test_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.est_test is distinct from old.est_test then
    raise exception 'Le statut test d''un document ne peut pas être modifié après sa création.'
      using errcode = 'check_violation';
  end if;
  if new.numero is distinct from old.numero
     or new.numero_test is distinct from old.numero_test then
    raise exception 'Le numéro d''un document ne peut pas être modifié.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rapports_lock_test_status on public.rapports;
create trigger trg_rapports_lock_test_status
before update on public.rapports
for each row execute function public.archives_lock_test_status();

drop trigger if exists trg_plaintes_lock_test_status on public.plaintes;
create trigger trg_plaintes_lock_test_status
before update on public.plaintes
for each row execute function public.archives_lock_test_status();

-- ====================================================================
-- 4. Droits
-- ====================================================================
-- Création : `est_test` choisi à l'insertion (pas de grant update).
grant insert (est_test) on public.rapports to authenticated;
grant insert (est_test) on public.plaintes to authenticated;

-- Suppression définitive : uniquement les tests, par leur créateur ou un
-- admin. Les documents officiels restent sans aucune policy DELETE
-- (corbeille via le serveur, comme avant).
grant delete on public.rapports to authenticated;
grant delete on public.plaintes to authenticated;

drop policy if exists "rapports_delete_test" on public.rapports;
create policy "rapports_delete_test"
  on public.rapports for delete
  to authenticated
  using (
    est_test
    and public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
  );

drop policy if exists "plaintes_delete_test" on public.plaintes;
create policy "plaintes_delete_test"
  on public.plaintes for delete
  to authenticated
  using (
    est_test
    and public.is_active_agent()
    and (created_by = auth.uid() or public.is_admin())
  );

-- ====================================================================
-- 5. Pas de pièces jointes sur un test
-- ====================================================================
-- Nouvel état 'test' : les policies de la table `attachments` et du
-- bucket (supabase/attachments.sql) n'autorisent l'ajout que sur une
-- fiche 'active' (ou 'absent' pendant la création) — un test est donc
-- refusé partout. Le formulaire de création n'envoie de toute façon
-- aucun fichier quand le mode test est coché.

create or replace function public.attachment_parent_state(p_type text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_deleted_at timestamptz;
  v_est_test boolean := false;
  v_found boolean;
begin
  if p_id is null then
    return null;
  end if;

  if p_type = 'investigation' then
    select deleted_at, true into v_deleted_at, v_found
    from public.investigations where id = p_id;
  elsif p_type = 'rapport' then
    select deleted_at, est_test, true into v_deleted_at, v_est_test, v_found
    from public.rapports where id = p_id;
  elsif p_type = 'plainte' then
    select deleted_at, est_test, true into v_deleted_at, v_est_test, v_found
    from public.plaintes where id = p_id;
  else
    return null;
  end if;

  if not coalesce(v_found, false) then
    return 'absent';
  end if;
  if v_est_test then
    return 'test';
  end if;
  return case when v_deleted_at is null then 'active' else 'deleted' end;
end;
$$;
