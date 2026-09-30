-- Gang Task Force — correctif (audit pré-V1, point S3) : fiabilité des
-- historiques (enquêtes, zones, laboratoires).
-- À exécuter APRÈS investigations.sql, zones.sql, lab_markers.sql et
-- permissions_unite.sql. IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Avant : tout agent actif (lecture seule comprise) pouvait insérer une
-- ligne d'historique, et le pseudo affiché (`agent_pseudo`) était du texte
-- libre fourni par le client → on pouvait écrire au nom d'un autre agent.
-- Après :
--   - le pseudo et l'agent sont posés par la base à partir de la session
--     (le client ne peut plus les choisir) ;
--   - seules les unités qui peuvent écrire la section (ID / GTF / EM,
--     admin) peuvent ajouter une ligne.
-- Les écritures du serveur en service_role (auth.uid() nul, ex. mise à la
-- corbeille) gardent les valeurs qu'il fournit, déjà contrôlées côté app.

create or replace function public.set_history_author()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.agent_id := auth.uid();
    new.agent_pseudo := coalesce(
      (select p.pseudo from public.profiles p where p.id = auth.uid()),
      new.agent_pseudo
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_investigation_history_author on public.investigation_history;
create trigger trg_investigation_history_author
before insert on public.investigation_history
for each row execute function public.set_history_author();

drop trigger if exists trg_zone_history_author on public.zone_history;
create trigger trg_zone_history_author
before insert on public.zone_history
for each row execute function public.set_history_author();

drop trigger if exists trg_lab_marker_history_author on public.lab_marker_history;
create trigger trg_lab_marker_history_author
before insert on public.lab_marker_history
for each row execute function public.set_history_author();

drop policy if exists "investigation_history_insert" on public.investigation_history;
create policy "investigation_history_insert"
  on public.investigation_history for insert
  to authenticated
  with check (
    agent_id = auth.uid()
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

drop policy if exists "zone_history_insert" on public.zone_history;
create policy "zone_history_insert"
  on public.zone_history for insert
  to authenticated
  with check (
    agent_id = auth.uid()
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );

drop policy if exists "lab_marker_history_insert" on public.lab_marker_history;
create policy "lab_marker_history_insert"
  on public.lab_marker_history for insert
  to authenticated
  with check (
    agent_id = auth.uid()
    and public.is_active_agent()
    and public.unite_peut_ecrire_operationnel()
  );
