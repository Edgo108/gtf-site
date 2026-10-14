-- Gang Task Force — Dispatch : statut par unité
-- À exécuter APRÈS dispatch.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Le dispatcheur actif (ou un admin) peut donner un statut à une unité
-- entière (disponible / occupe / en_intervention, ou aucun) :
--   - le statut d'unité s'applique à tous les agents qu'elle contient,
--     en une seule opération (fonction set_dispatch_unit_statut) ;
--   - un agent qui arrive dans une unité à statut prend ce statut ; dans
--     une unité sans statut, comportement inchangé (attente → disponible) ;
--   - un agent placé dans une unité à statut ne peut plus changer son
--     propre statut (trigger agent_status_guard) ; le dispatcheur / l'admin
--     peut toujours changer le statut d'UN agent, jusqu'au prochain
--     changement de statut de l'unité qui resynchronise tout le monde ;
--   - « Reset dispatch » (fonction reset_dispatch) remet aussi tous les
--     statuts d'unité à null, de façon atomique.
-- Realtime : dispatch_units et agent_status sont déjà publiés
-- (dispatch.sql), les clients relisent l'état à chaque changement.

-- ====================================================================
-- 1. Colonne
-- ====================================================================

alter table public.dispatch_units add column if not exists statut text;

alter table public.dispatch_units drop constraint if exists dispatch_units_statut_check;
alter table public.dispatch_units add constraint dispatch_units_statut_check
  check (statut in ('disponible', 'occupe', 'en_intervention'));

-- Pas de grant UPDATE sur `statut` : il ne change que par les fonctions
-- ci-dessous (la policy dispatch_units_update laisse aussi les agents de
-- l'unité modifier la catégorie, pas le statut).

-- ====================================================================
-- 2. Garde-fou agent_status (remplace la version de dispatch.sql)
-- ====================================================================
-- Ajouts par rapport à dispatch.sql :
--   - arrivée dans une unité à statut → l'agent prend ce statut (pour
--     tout le monde, service_role compris) ;
--   - un agent non privilégié ne change pas son statut lui-même tant que
--     son unité a un statut défini.

create or replace function public.agent_status_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_unit_statut text;
  v_unit_nom text;
  v_privileged boolean;
begin
  if auth.uid() is not null then
    v_privileged := public.is_admin() or public.is_active_dispatcher();

    if tg_op = 'UPDATE' then
      if new.agent_id <> old.agent_id then
        raise exception 'agent_id non modifiable';
      end if;

      if not v_privileged then
        if new.unite_id is distinct from old.unite_id then
          raise exception 'Seul le dispatcheur peut changer l''unité d''un agent.';
        end if;

        if new.statut is distinct from old.statut and old.unite_id is not null then
          select statut, nom into v_unit_statut, v_unit_nom
          from public.dispatch_units where id = old.unite_id;
          if v_unit_statut is not null then
            raise exception 'Statut imposé par l''unité %.', v_unit_nom
              using errcode = 'check_violation';
          end if;
        end if;
      end if;
    end if;

    new.updated_by := auth.uid();
  end if;

  -- Arrivée dans une unité (nouvelle affectation ou changement d'unité).
  if tg_op = 'UPDATE'
     and new.unite_id is not null
     and new.unite_id is distinct from old.unite_id then
    select statut into v_unit_statut
    from public.dispatch_units where id = new.unite_id;

    if v_unit_statut is not null then
      new.statut := v_unit_statut;
    elsif old.statut = 'en_attente_dispatch'
          and new.statut = 'en_attente_dispatch' then
      -- Comportement existant : sortie d'attente → disponible.
      new.statut := 'disponible';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- (Le trigger trg_agent_status_guard de dispatch.sql pointe déjà sur
-- cette fonction : rien à recréer.)

-- ====================================================================
-- 3. Statut d'une unité (atomique)
-- ====================================================================
-- p_statut null = « aucun » : les agents gardent leur statut actuel et
-- retrouvent la main dessus. Sinon tous les agents de l'unité prennent ce
-- statut dans la même transaction. Réservé au dispatcheur actif et à
-- l'admin. SECURITY DEFINER pour écrire `statut` (non granté) ; les
-- droits sont vérifiés ici, à partir de auth.uid().

create or replace function public.set_dispatch_unit_statut(p_unit_id uuid, p_statut text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_active_agent() and (public.is_admin() or public.is_active_dispatcher())) then
    raise exception 'Seul le dispatcheur actif ou un admin peut changer le statut d''une unité.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_statut is not null and p_statut not in ('disponible', 'occupe', 'en_intervention') then
    raise exception 'Statut d''unité invalide.' using errcode = 'check_violation';
  end if;

  update public.dispatch_units set statut = p_statut where id = p_unit_id;
  if not found then
    raise exception 'Unité introuvable.' using errcode = 'no_data_found';
  end if;

  if p_statut is not null then
    update public.agent_status set statut = p_statut where unite_id = p_unit_id;
  end if;
end;
$$;

revoke all on function public.set_dispatch_unit_statut(uuid, text) from public, anon;
grant execute on function public.set_dispatch_unit_statut(uuid, text) to authenticated;

-- ====================================================================
-- 4. Reset dispatch (atomique)
-- ====================================================================
-- Tous les agents en service → en attente, sans unité ; toutes les
-- unités perdent catégorie de patrouille ET statut. Réservé au
-- dispatcheur actif (pas à l'admin qui ne l'est pas : règle existante).

create or replace function public.reset_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_dispatcher() then
    raise exception 'Seul le dispatcheur actif peut réinitialiser le dispatch.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.agent_status
  set statut = 'en_attente_dispatch', unite_id = null
  where id is not null;

  update public.dispatch_units
  set categorie_patrouille = null, statut = null
  where id is not null;
end;
$$;

revoke all on function public.reset_dispatch() from public, anon;
grant execute on function public.reset_dispatch() to authenticated;
