-- Gang Task Force — Code Pénal (« Livre des peines »)
-- À exécuter APRÈS schema.sql et investigations.sql (réutilise
-- public.is_active_agent()).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Référentiel en lecture seule : aucun droit d'écriture pour
-- authenticated. Les corrections de données passent par le service_role
-- (ou l'éditeur SQL). Idempotent : ré-exécutable sans casser.

create table if not exists public.code_penal_articles (
  id uuid primary key default gen_random_uuid(),
  categorie text not null check (categorie in ('A', 'B', 'C')),
  nature text not null,
  numero_article text not null unique,
  titre text not null,
  -- Montant fixe : amende_min/amende_max remplis, amende_formule null.
  -- Montant variable : amende_formule rempli, amende_min/amende_max null.
  amende_min numeric check (amende_min is null or amende_min >= 0),
  amende_max numeric check (amende_max is null or amende_max >= 0),
  amende_formule text,
  peine_prison_up integer check (peine_prison_up is null or peine_prison_up >= 0),
  condition text,
  sanction_complementaire text,
  requalification text,
  remarque text,
  definition text not null default '',
  constraint code_penal_amende_coherente check (
    (amende_min is null or amende_max is null or amende_min <= amende_max)
    and (amende_formule is null or (amende_min is null and amende_max is null))
  )
);

create index if not exists code_penal_articles_categorie_idx
  on public.code_penal_articles (categorie);

alter table public.code_penal_articles enable row level security;

revoke all on public.code_penal_articles from anon;
revoke all on public.code_penal_articles from authenticated;

-- Lecture seule pour tout agent actif (non suspendu).
grant select on public.code_penal_articles to authenticated;

drop policy if exists "code_penal_articles_select" on public.code_penal_articles;
create policy "code_penal_articles_select"
  on public.code_penal_articles for select
  to authenticated
  using (public.is_active_agent());
