-- Gang Task Force — Section Enquêtes fermée aux unités SASP et DOJ
-- À exécuter APRÈS investigations.sql, permissions_unite.sql,
-- unite_etat_major.sql et attachments.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Avant : tout agent actif lisait les enquêtes (SASP / DOJ en lecture
-- seule). Après : lecture réservée aux unités ID / GTF / EM et aux admins,
-- pour les fiches, leur historique et (déjà le cas) leurs pièces jointes.
-- L'écriture ne change pas (déjà réservée à ID / GTF / EM / admin).
-- Côté application : canAccessEnquetes() dans lib/permissions.ts.

create or replace function public.unite_peut_lire_enquetes()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_admin() or public.mon_unite() in ('ID', 'GTF', 'EM');
$$;

grant execute on function public.unite_peut_lire_enquetes() to authenticated;

drop policy if exists "investigations_select" on public.investigations;
create policy "investigations_select"
  on public.investigations for select
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_lire_enquetes()
  );

drop policy if exists "investigation_history_select" on public.investigation_history;
create policy "investigation_history_select"
  on public.investigation_history for select
  to authenticated
  using (public.is_active_agent() and public.unite_peut_lire_enquetes());

-- Pièces jointes : même règle, écrite avec le nouvel helper (le résultat
-- est identique à la version de attachments.sql).
create or replace function public.can_read_attachment_parent(p_type text, p_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_active_agent()
    and case p_type
      when 'investigation' then
        public.unite_peut_lire_enquetes()
        and exists (select 1 from public.investigations where id = p_id)
      when 'rapport' then
        exists (select 1 from public.rapports where id = p_id)
      when 'plainte' then
        exists (select 1 from public.plaintes where id = p_id)
      else false
    end;
$$;
