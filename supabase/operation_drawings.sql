-- Gang Task Force — Carte de planification des opérations (dessins libres)
-- À exécuter APRÈS operations.sql (réutilise public.can_access_operation()).
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- ISOLATION VOULUE : cette table n'a AUCUN lien avec sensitive_zones ni
-- lab_markers. Les tracés dessinés ici ne sont lus que par la carte de
-- planification d'UNE opération précise (filtrés par operation_id côté
-- app) — ils ne peuvent donc jamais apparaître sur la carte principale du
-- site (/zones), qui n'interroge pas cette table, ni fuiter d'une
-- opération à une autre.

create table if not exists public.operation_drawings (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  type_element text not null check (
    type_element in ('trait_libre', 'fleche', 'cercle', 'ligne', 'texte')
  ),
  -- Forme selon type_element (points/coordonnées en unités carte, mêmes
  -- que sensitive_zones.points / lab_markers.position) :
  --   trait_libre : { points: [{x,y}, ...], couleur, epaisseur }
  --   ligne/fleche: { from: {x,y}, to: {x,y}, couleur, epaisseur }
  --   cercle      : { center: {x,y}, radius: number, couleur, epaisseur }
  --   texte       : { point: {x,y}, texte, couleur }
  donnees jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Droit d'écriture identique à celui de l'opération elle-même (admin,
-- lead, agent en écriture) : l'accès au détail d'une opération est déjà
-- réservé à ces trois profils, donc aucune restriction supplémentaire à
-- appliquer ici (cf. can_access_operation dans supabase/operations.sql).
-- Pas d'UPDATE : un élément se supprime et se redessine, il ne se modifie
-- pas en place.

alter table public.operation_drawings enable row level security;

revoke all on public.operation_drawings from anon;
revoke all on public.operation_drawings from authenticated;

grant select, insert, delete on public.operation_drawings to authenticated;

drop policy if exists "operation_drawings_select" on public.operation_drawings;
create policy "operation_drawings_select"
  on public.operation_drawings for select
  to authenticated
  using (public.can_access_operation(operation_id));

drop policy if exists "operation_drawings_insert" on public.operation_drawings;
create policy "operation_drawings_insert"
  on public.operation_drawings for insert
  to authenticated
  with check (
    public.can_access_operation(operation_id)
    and created_by = auth.uid()
  );

drop policy if exists "operation_drawings_delete" on public.operation_drawings;
create policy "operation_drawings_delete"
  on public.operation_drawings for delete
  to authenticated
  using (public.can_access_operation(operation_id));
