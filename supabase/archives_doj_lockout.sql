-- Gang Task Force — Rapports et Plaintes fermés à l'unité DOJ
-- À exécuter APRÈS archives_rapports_plaintes.sql, rapport_infractions.sql,
-- attachments.sql, investigations_unite_lecture.sql et
-- archives_mode_test.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- DOJ n'a plus aucun accès aux Rapports et Plaintes (ni lecture, ni
-- écriture), pièces jointes et infractions comprises. Le seul moyen pour
-- DOJ d'obtenir un document est un PDF exporté par un autre agent.
-- Rien ne change pour ID / GTF / EM / SASP / admin.
--   - rapports / plaintes : condition ajoutée aux policies existantes ;
--   - rapport_infractions : ses policies exigent déjà que le rapport soit
--     visible (« exists … from rapports ») → fermé par ricochet ;
--   - attachments + bucket : lecture via can_read_attachment_parent()
--     (rapport/plainte visible → fermé par ricochet), écriture via
--     can_write_attachment_type() redéfinie ci-dessous.
-- Côté application : canAccessArchives() dans lib/permissions.ts.

create or replace function public.unite_peut_lire_archives()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_admin()
    or public.mon_unite() in ('ID', 'GTF', 'EM', 'SASP');
$$;

grant execute on function public.unite_peut_lire_archives() to authenticated;

-- --- rapports ---------------------------------------------------------

drop policy if exists "rapports_select" on public.rapports;
create policy "rapports_select"
  on public.rapports for select
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_lire_archives()
  );

drop policy if exists "rapports_insert" on public.rapports;
create policy "rapports_insert"
  on public.rapports for insert
  to authenticated
  with check (
    public.is_active_agent()
    and created_by = auth.uid()
    and public.unite_peut_lire_archives()
  );

drop policy if exists "rapports_update" on public.rapports;
create policy "rapports_update"
  on public.rapports for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_lire_archives()
  )
  with check (public.is_active_agent() and public.unite_peut_lire_archives());

drop policy if exists "rapports_delete_test" on public.rapports;
create policy "rapports_delete_test"
  on public.rapports for delete
  to authenticated
  using (
    est_test
    and public.is_active_agent()
    and public.unite_peut_lire_archives()
    and (created_by = auth.uid() or public.is_admin())
  );

-- --- plaintes ---------------------------------------------------------

drop policy if exists "plaintes_select" on public.plaintes;
create policy "plaintes_select"
  on public.plaintes for select
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_lire_archives()
  );

drop policy if exists "plaintes_insert" on public.plaintes;
create policy "plaintes_insert"
  on public.plaintes for insert
  to authenticated
  with check (
    public.is_active_agent()
    and created_by = auth.uid()
    and public.unite_peut_lire_archives()
  );

drop policy if exists "plaintes_update" on public.plaintes;
create policy "plaintes_update"
  on public.plaintes for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and public.unite_peut_lire_archives()
  )
  with check (public.is_active_agent() and public.unite_peut_lire_archives());

drop policy if exists "plaintes_delete_test" on public.plaintes;
create policy "plaintes_delete_test"
  on public.plaintes for delete
  to authenticated
  using (
    est_test
    and public.is_active_agent()
    and public.unite_peut_lire_archives()
    and (created_by = auth.uid() or public.is_admin())
  );

-- --- pièces jointes : écriture (ajout / suppression, brouillons compris)

create or replace function public.can_write_attachment_type(p_type text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_active_agent()
    and case p_type
      when 'investigation' then public.unite_peut_ecrire_operationnel()
      when 'rapport' then public.unite_peut_lire_archives()
      when 'plainte' then public.unite_peut_lire_archives()
      else false
    end;
$$;
