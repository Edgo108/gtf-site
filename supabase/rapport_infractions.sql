-- Gang Task Force — Infractions (Code Pénal) liées à un Rapport
-- À exécuter APRÈS archives_rapports_plaintes.sql et code_penal.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Remplace, dans le formulaire Rapport, le texte libre « Faits
-- reprochés » par une liste d'articles du Code Pénal. La colonne
-- rapports.faits_reproches n'est plus lue ni écrite par le site.
--
-- Permissions : identiques au Rapport (tout agent actif lit et modifie
-- les infractions d'un rapport qui n'est pas en corbeille).

create table if not exists public.rapport_infractions (
  id uuid primary key default gen_random_uuid(),
  rapport_id uuid not null references public.rapports (id) on delete cascade,
  article_id uuid not null references public.code_penal_articles (id) on delete restrict,
  -- Articles à formule uniquement : valeur saisie (montant volé, nombre
  -- d'unités…) et amende qui en résulte (utilisée comme min ET max).
  variable_utilisee numeric check (variable_utilisee is null or variable_utilisee >= 0),
  montant_calcule numeric check (montant_calcule is null or montant_calcule >= 0),
  -- Ordre d'ajout dans la liste.
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists rapport_infractions_rapport_idx
  on public.rapport_infractions (rapport_id, position);
create index if not exists rapport_infractions_article_idx
  on public.rapport_infractions (article_id);

alter table public.rapport_infractions enable row level security;

revoke all on public.rapport_infractions from anon;
revoke all on public.rapport_infractions from authenticated;

grant select, delete on public.rapport_infractions to authenticated;
grant insert (rapport_id, article_id, variable_utilisee, montant_calcule, position)
  on public.rapport_infractions to authenticated;
-- Pas d'UPDATE : la liste est remplacée en bloc à chaque enregistrement.

-- La sous-requête sur rapports passe par la RLS de rapports : un rapport
-- en corbeille (ou un agent suspendu) n'y est pas visible.
drop policy if exists "rapport_infractions_select" on public.rapport_infractions;
create policy "rapport_infractions_select"
  on public.rapport_infractions for select
  to authenticated
  using (
    public.is_active_agent()
    and exists (select 1 from public.rapports r where r.id = rapport_id)
  );

drop policy if exists "rapport_infractions_insert" on public.rapport_infractions;
create policy "rapport_infractions_insert"
  on public.rapport_infractions for insert
  to authenticated
  with check (
    public.is_active_agent()
    and exists (select 1 from public.rapports r where r.id = rapport_id)
  );

drop policy if exists "rapport_infractions_delete" on public.rapport_infractions;
create policy "rapport_infractions_delete"
  on public.rapport_infractions for delete
  to authenticated
  using (
    public.is_active_agent()
    and exists (select 1 from public.rapports r where r.id = rapport_id)
  );

-- Remplacement atomique de la liste d'un rapport (suppression + insertion
-- dans la même transaction). SECURITY INVOKER : la RLS ci-dessus
-- s'applique à l'appelant.
-- p_items : [{ "article_id": uuid, "variable_utilisee": num|null,
--              "montant_calcule": num|null }, …] dans l'ordre d'affichage.
create or replace function public.set_rapport_infractions(
  p_rapport_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (select 1 from public.rapports where id = p_rapport_id) then
    raise exception 'Rapport introuvable' using errcode = '42501';
  end if;

  delete from public.rapport_infractions where rapport_id = p_rapport_id;

  insert into public.rapport_infractions
    (rapport_id, article_id, variable_utilisee, montant_calcule, position)
  select
    p_rapport_id,
    (item ->> 'article_id')::uuid,
    (item ->> 'variable_utilisee')::numeric,
    (item ->> 'montant_calcule')::numeric,
    (ord - 1)::integer
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    with ordinality as t(item, ord);
end;
$$;

revoke all on function public.set_rapport_infractions(uuid, jsonb) from public, anon;
grant execute on function public.set_rapport_infractions(uuid, jsonb) to authenticated;
